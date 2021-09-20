import isObject from "is-object";

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
