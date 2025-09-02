import { EventEmitter } from "events";
import { nanoid } from "nanoid";

const buses = new Map(); // jobId -> EventEmitter
const states = new Map(); // jobId -> { status, done, error, files? }

export function createJob() {
  const id = nanoid();
  const bus = new EventEmitter();
  buses.set(id, bus);
  states.set(id, { status: "created", done: false });
  return { id, bus };
}

export function getBus(jobId) {
  return buses.get(jobId);
}
export function getState(jobId) {
  return states.get(jobId);
}
export function setState(jobId, patch) {
  const cur = states.get(jobId) || {};
  states.set(jobId, { ...cur, ...patch });
}
export function finishJob(jobId) {
  const bus = buses.get(jobId);
  if (bus) bus.emit("end");
  setState(jobId, { done: true });
}
export function failJob(jobId, error) {
  const bus = buses.get(jobId);
  if (bus) bus.emit("error", error?.message || String(error));
  setState(jobId, { done: true, error: error?.message || String(error) });
}
