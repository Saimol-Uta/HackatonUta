import { getContainer } from "@/server/container";
import { operatorAction } from "@/server/operator-action-route";

export const POST = operatorAction((id) => getContainer().resumeAi(id));
