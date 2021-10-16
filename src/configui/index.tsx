import React, { useMemo } from "react";
import { render } from "react-dom";
import styled from "styled-components";
import Select from "react-select";

import type { Config } from "../board";
import useConfig from "./useConfig";
import RuleEditor from "./RuleEditor";
import { capitalize } from "../utils";

export interface ConfigUIData {
  config: Config;
  targetPath: string;
  ruleEditorTypes: { [rule: string]: string };
  allTags: string[];
  allNotebooks: string[];
}

function AddRuleBtn({
  onAdd,
  rules,
}: {
  onAdd: (newRuleType: string) => void;
  rules: string[];
}) {
  const options = [
    { value: "", label: "Add a new rule" },
    ...rules.map((r) => ({ value: r, label: capitalize(r) })),
  ];

  const handleChange: Select["onChange"] = (ev) => {
    if (ev && ev.value !== "") {
      if (ev.value === "backlog") {
        const confirmed = window.confirm(
          "Adding a backlog column will delete all other rules! Are you sure you want to add it?"
        );
        if (!confirmed) return;
      }
      onAdd(ev.value);
    }
  };

  return (
    <Select
      isClearable={false}
      isSearchable={false}
      value={options[0]}
      options={options}
      onChange={handleChange}
    />
  );
}

function App() {
  const {
    config: inputConfig,
    targetPath,
    ruleEditorTypes,
    allTags,
    allNotebooks,
  } = useMemo(
    () =>
      JSON.parse(
        document.getElementById("data")?.innerHTML as string
      ) as ConfigUIData,
    []
  );
  const { editedObj, onPropChange, onDeleteProp, yamlConfig } = useConfig(
    targetPath,
    inputConfig
  );

  let props = Object.entries(editedObj)
    .filter(([k]) => k !== "name")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 0 : 1));
  if ("name" in editedObj) props = [["name", editedObj.name], ...props];

  const addableRules =
    "backlog" in editedObj && editedObj.backlog
      ? []
      : Object.keys(ruleEditorTypes).filter((r) => !(r in editedObj));

  return (
    <Cont>
      <Title>{capitalize(targetPath.split(".", 2)[0])}</Title>

      <RulesCont>
        {props.map(([ruleName, ruleVal], idx) => (
          <RuleEditor
            key={idx}
            canDelete={ruleName !== "name"}
            ruleType={ruleName}
            ruleValue={ruleVal}
            editorType={ruleEditorTypes[ruleName]}
            allTags={allTags}
            allNotebooks={allNotebooks}
            onChange={(newVal) => onPropChange(ruleName, newVal)}
            onDelete={() => onDeleteProp(ruleName)}
          />
        ))}

        {addableRules.length > 0 && (
          <AddRuleBtn
            rules={addableRules}
            onAdd={(rule) => onPropChange(rule, "")}
          />
        )}
      </RulesCont>

      <form name="config">
        <input type="hidden" name="yaml" value={yamlConfig} />
      </form>
    </Cont>
  );
}

const Title = styled("div")({
  fontSize: "1.3em",
  fontWeight: "bold",
  marginBottom: "10px",
});

const Cont = styled("div")({
  fontSize: "1.2em",
});

const RulesCont = styled("div")({
  paddingLeft: "10px",
});

render(<App />, document.getElementById("root"));
