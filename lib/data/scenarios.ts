import { database, newId, type Scenario, type ScenarioInputs, type WorkingState } from "@/lib/db";

const table = async () => (await database.ready()).scenarios;

export async function listScenarios(): Promise<Scenario[]> {
  return (await table()).orderBy("createdAt").toArray();
}

export async function addScenario(name: string, inputs: ScenarioInputs): Promise<Scenario> {
  const scenario: Scenario = { ...inputs, id: newId(), name, createdAt: Date.now() };
  await (await table()).add(scenario);
  return scenario;
}

export async function deleteScenario(id: string): Promise<void> {
  await (await table()).delete(id);
}

const stateTable = async () => (await database.ready()).state;

export async function getWorkingState(): Promise<WorkingState | undefined> {
  return (await stateTable()).get("working");
}

export async function saveWorkingState(inputs: ScenarioInputs): Promise<void> {
  await (await stateTable()).put({ id: "working", inputs, updatedAt: Date.now() });
}
