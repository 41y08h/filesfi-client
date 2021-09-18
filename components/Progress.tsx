import { FC, DetailedHTMLProps, HTMLAttributes } from "react";

interface Props
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  value: number;
}

const Progress: FC<Props> = ({ value, ...props }) => {
  return (
    <div {...props}>
      <div
        style={{ width: `${value * 100}%` }}
        className="bg-white h-progress"
      />
    </div>
  );
};

export default Progress;
