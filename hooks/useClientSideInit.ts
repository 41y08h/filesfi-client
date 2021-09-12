import { useEffect, useState } from "react";

export default function useClientSideInit<T>(initializer: () => T) {
  const [value, setValue] = useState<T>();

  useEffect(() => {
    setValue(initializer());
  }, []);

  return value;
}
