import React from "react";
import styled from "styled-components";
import { IoIosRemoveCircleOutline } from "react-icons/io";
// import Select from "react-select";
import CreatableSelect from "react-select/creatable";

import type { RuleValue } from "../board";
import { capitalize } from "../utils";

const prettyRuleName = (n: string) =>
  capitalize(n.replace(/([a-z])([A-Z])/g, "$1 $2"));

export default function ({
  ruleType,
  ruleValue,
  editorType,
  allTags,
  allNotebooks,
  canDelete,
  onChange,
  onDelete,
}: {
  ruleType: string;
  ruleValue: RuleValue;
  editorType: string;
  allTags: string[];
  allNotebooks: string[];
  canDelete: boolean;
  onChange: (newVal: RuleValue) => void;
  onDelete: () => void;
}) {
  let inputEl: JSX.Element;
  if (editorType === "checkbox")
    inputEl = (
      <Input
        type="checkbox"
        checked={!!ruleValue}
        onChange={(ev) => onChange(!!ev.target.checked)}
      />
    );
  else if (editorType === "tags")
    inputEl = (
      <CreatableSelect
        styles={{ container: (p) => ({ ...p, width: "100%" }) }}
        isMulti
        value={
          Array.isArray(ruleValue)
            ? ruleValue.map((t) => ({ value: t, label: t }))
            : []
        }
        options={allTags.map((t) => ({
          value: t,
          label: t,
        }))}
        onChange={(sel) => onChange(sel.map((s) => s.value))}
      />
    );
  else if (editorType === "notebook") {
    const options = allNotebooks.map((t) => ({
      value: t,
      label: t,
    }));

    if (ruleType === "rootNotebookPath") {
      options.push({
        value: "/",
        label: "All notebooks",
      });
    }

    inputEl = (
      <CreatableSelect
        styles={{ container: (p) => ({ ...p, width: "100%" }) }}
        isClearable={false}
        value={
          ruleValue && allNotebooks.includes(ruleValue as string)
            ? {
                value: ruleValue,
                label:
                  ruleType === "rootNotebookPath" && ruleValue === "/"
                    ? "All notebooks"
                    : ruleValue,
              }
            : undefined
        }
        options={options}
        onChange={(sel) => sel && onChange(sel.value)}
      />
    );
  } else
    inputEl = (
      <Input
        type="text"
        value={`${ruleValue}`}
        onChange={(ev) => onChange(ev.target.value)}
      />
    );

  return (
    <Row>
      <Label>{prettyRuleName(ruleType)}:</Label>
      <InputCont>{inputEl}</InputCont>
      {canDelete && <RemoveIcon size="20px" onClick={() => onDelete()} />}
    </Row>
  );
}

const Row = styled("div")({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  width: "100%",
  marginBottom: "10px",
});

const Label = styled("label")({
  width: "30%",
});

const InputCont = styled("div")({
  flexGrow: 1,
  display: "flex",
  flexDirection: "row-reverse",
  alignItems: "center",
});

const Input = styled("input")({
  width: "100%",
  padding: "5px",
});

const RemoveIcon = styled(IoIosRemoveCircleOutline)({
  cursor: "pointer",
  marginLeft: "10px",
});
