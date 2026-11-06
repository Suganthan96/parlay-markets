/**
 * CRE workflow entrypoint.
 * The CRE CLI loads this file; it must export a default function that calls initWorkflow.
 */
import * as cre from "@chainlink/cre-sdk"
import initWorkflow from "./workflow.js"

export default function (runtime: cre.Runtime, config: unknown) {
  return initWorkflow(runtime, config as Parameters<typeof initWorkflow>[1])
}
