import React, { useState } from "react";

export const PathInput = function PathInput() {
  const [value, setValue] = useState("");
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
  }
  return (
    <input
      style={{ width: 200, height: 200 }}
      value={value}
      onChange={(e) => handleChange(e)}
    />
  );
};
