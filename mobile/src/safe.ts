/** The only place a failure may be swallowed. */

/** Continue after a failure the screen has already decided not to show. */
export function ignore(): void {
  // The caller keeps going.
}

/** Read a JSON body. A body that is not JSON becomes null, the same as an empty failure. */
export async function readJson(response: { json(): Promise<unknown> }): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
