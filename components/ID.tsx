import { FC } from "react";
import styles from "../styles/ID.module.scss";

interface Props {
  id: number;
}

const ID: FC<Props> = ({ id }) => {
  return (
    <div className={styles.root}>
      {Array.from(String(id)).map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </div>
  );
};

export default ID;
