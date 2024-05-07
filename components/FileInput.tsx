import {
  FC,
  DetailedHTMLProps,
  LabelHTMLAttributes,
  useState,
  DragEventHandler,
} from "react";

interface Props
  extends Omit<
    DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>,
    "onChange"
  > {
  onChange: (files: FileList) => unknown;
  droppable?: boolean;
}

const FileInput: FC<Props> = ({
  children,
  onChange,
  droppable = false,
  ...props
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver: DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };
  function handleDragOverEnd() {
    setIsDragging(false);
  }

  const handleDrop: DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    const fileList = event.dataTransfer.files;
    onChange(fileList);
    setIsDragging(false);
  };

  const droppableProps = droppable
    ? {
        onDragOver: handleDragOver,
        onDragLeave: handleDragOverEnd,
        onDrop: handleDrop,
      }
    : {};

  return (
    <label htmlFor="fileUpload" {...props} {...droppableProps}>
      {isDragging ? "Release file here" : children}
      <input
        type="file"
        multiple
        className="hidden"
        id="fileUpload"
        value="" // to fire onChange on every file select (not only change in selected file)
        onChange={({ target: { files } }) => {
          if (files) {
            onChange(files);
          }
        }}
      />
    </label>
  );
};

export default FileInput;
