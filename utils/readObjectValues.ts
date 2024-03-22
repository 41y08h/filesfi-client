import isObject from "is-object";

/** Recursively reads the values of an object and provides it as path and key arguments the passed callback function
 *
 * Example:
 * ```
 * const profile = {user: "john", age: 24, filesIDs: [12, 48, 46, 78], about: {bioText: "lorem ipsum", city: "mumbai"}}
 *
 * readObjectValues(profile, (pathname, value) => console.log(pathname, value))
 * // user john
 * // age 24
 * // filesIDs.0 12
 * // filesIDs.1 48
 * // filesIDs.2 46
 * // filesIDs.3 78
 * // about.bioText lorem ipsum
 * // about.city mumbai
 *
 * ```
 *
 * Notice how the array pathname has the value's index in it.
 */

export default function readObjectValues(
  object: Object,
  onRead: (pathname: string, value: any) => unknown
) {
  for (const key in object) {
    if (isObject(object[key])) {
      const constructor = object[key].constructor.name;
      if (["Object", "Array"].includes(constructor))
        readObjectValues(object[key], (pathname, value) => {
          onRead(`${key}.${pathname}`, value);
        });
      else onRead(key, object[key]);
    } else {
      onRead(key, object[key]);
    }
  }
}
