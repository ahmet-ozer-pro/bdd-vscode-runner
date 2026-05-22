import test from 'node:test';
import * as assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { ProcessRunnerCoordinator } from '../../core/processRunner';

class FakeStream extends EventEmitter {
  emitData(value: string): void {
    this.emit('data', value);
  }
}

class FakeChildProcess extends EventEmitter {
  stdout = new FakeStream();
  stderr = new FakeStream();
  killed = false;

  kill(): boolean {
    this.killed = true;
    this.emit('close', 143);
    return true;
  }
}

function asChildProcess(fakeChild: FakeChildProcess): ChildProcessWithoutNullStreams {
  return fakeChild as unknown as ChildProcessWithoutNullStreams;
}

test('ProcessRunnerCoordinator streams output and completes one run', async () => {
  const fakeChild = new FakeChildProcess();
  const events: string[] = [];
  const coordinator = new ProcessRunnerCoordinator(() => asChildProcess(fakeChild));

  const started = coordinator.start(
    {
      executable: 'mvn',
      args: ['test'],
      cwd: '/workspace/app',
      env: process.env,
      displayCommand: 'mvn test',
    },
    {
      onStart: () => events.push('start'),
      onStdout: (chunk) => events.push(`stdout:${chunk}`),
      onStderr: (chunk) => events.push(`stderr:${chunk}`),
      onExit: (result) => events.push(`exit:${result.exitCode}:${result.cancelled}`),
    }
  );

  assert.equal(started.started, true);
  if (!started.started) {
    return;
  }

  fakeChild.stdout.emitData('hello');
  fakeChild.stderr.emitData('warning');
  fakeChild.emit('close', 0);

  const result = await started.run.completed;

  assert.deepEqual(events, ['start', 'stdout:hello', 'stderr:warning', 'exit:0:false']);
  assert.deepEqual(result, { exitCode: 0, cancelled: false });
  assert.equal(coordinator.getActiveRun(), undefined);
});

test('ProcessRunnerCoordinator prevents parallel starts while a run is active', () => {
  const fakeChild = new FakeChildProcess();
  const coordinator = new ProcessRunnerCoordinator(() => asChildProcess(fakeChild));

  const first = coordinator.start({
    executable: 'mvn',
    args: ['test'],
    cwd: '/workspace/app',
    env: process.env,
    displayCommand: 'mvn test',
  });
  const second = coordinator.start({
    executable: 'mvn',
    args: ['verify'],
    cwd: '/workspace/app',
    env: process.env,
    displayCommand: 'mvn verify',
  });

  assert.equal(first.started, true);
  assert.equal(second.started, false);
});

test('ProcessRunnerCoordinator cancels the active run', async () => {
  const fakeChild = new FakeChildProcess();
  const coordinator = new ProcessRunnerCoordinator(() => asChildProcess(fakeChild));

  const started = coordinator.start({
    executable: 'mvn',
    args: ['test'],
    cwd: '/workspace/app',
    env: process.env,
    displayCommand: 'mvn test',
  });

  assert.equal(started.started, true);
  if (!started.started) {
    return;
  }

  assert.equal(coordinator.cancelActiveRun(), true);
  const result = await started.run.completed;

  assert.equal(fakeChild.killed, true);
  assert.deepEqual(result, { exitCode: 143, cancelled: true });
});

test('ProcessRunnerCoordinator resolves completed with exitCode 1 when spawn throws synchronously', async () => {
  const coordinator = new ProcessRunnerCoordinator(() => {
    throw new Error('spawn failed');
  });
  const errors: string[] = [];

  const started = coordinator.start(
    {
      executable: 'mvn',
      args: ['test'],
      cwd: '/workspace',
      env: process.env,
      displayCommand: 'mvn test',
    },
    {
      onError: (err) => errors.push(err.message),
    }
  );

  assert.equal(started.started, true);
  if (!started.started) {
    return;
  }

  const result = await started.run.completed;

  assert.deepEqual(result, { exitCode: 1, cancelled: false });
  assert.deepEqual(errors, ['spawn failed']);
  assert.equal(coordinator.getActiveRun(), undefined);
});
