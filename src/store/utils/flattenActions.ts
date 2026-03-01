/**
 * Flatten multiple action objects (typically class instances) into a single plain object
 *
 * Solves the problem that class instances cannot correctly copy prototype methods via the spread operator.
 * Uses reflection to traverse the prototype chain, extract all public methods, and bind the `this` context.
 *
 * @param actions - Array of action objects (typically class instances)
 * @returns A plain object containing all action methods
 *
 * @example
 * ```ts
 * const store = {
 *   ...initialState,
 *   ...flattenActions([slice1(...params), slice2(...params)]),
 * };
 * ```
 */
export const flattenActions = <T extends object>(actions: object[]): T => {
  const result = {} as T;

  for (const action of actions) {
    // Traverse the prototype chain to retrieve all methods
    let current: object | null = action;
    while (current && current !== Object.prototype) {
      const keys = Object.getOwnPropertyNames(current);

      for (const key of keys) {
        if (key === 'constructor') continue;
        if (key in result) continue; // Skip already-existing properties (the first action's method takes precedence)

        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor) continue;

        if (typeof descriptor.value === 'function') {
          // Method: bind `this` context to the original action instance
          (result as any)[key] = descriptor.value.bind(action);
        } else {
          // Non-function property: copy the descriptor directly
          Object.defineProperty(result, key, {
            ...descriptor,
            configurable: true,
            enumerable: true,
          });
        }
      }

      current = Object.getPrototypeOf(current);
    }
  }

  return result;
};
