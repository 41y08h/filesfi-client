import { FC } from "react";
import styles from "../styles/IdDisplay.module.scss";

interface Props {
  id: number;
}

const IdDisplay: FC<Props> = ({ id }) => {
  return (
    <div className={styles.root}>
      {Array.from(String(id)).map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </div>
  );
};

export default IdDisplay;
