import { useState, useEffect } from "react";
import * as yaml from "js-yaml";

import type { Config, RuleValue } from "../types";
import { toggleSingularPlural } from "../utils";

export default function (editedPath: string, inputConfig: Config) {
  const [editedKey, colIdxStr = null] = editedPath.split(".", 2) as [
    string,
    string
  ];
  const [editedColIdx, setEditedColIdx] = useState(
    colIdxStr === null ? null : parseInt(colIdxStr)
  );

  const [editedObj, setEditedObj] = useState(() => {
    if (editedColIdx !== null) return inputConfig.columns[editedColIdx];
    if (editedKey in inputConfig) return inputConfig[editedKey as keyof Config];
    return {};
  });

  const onPropChange = (prop: string, newVal: RuleValue) =>
    setEditedObj((obj) => ({ ...obj, [prop]: newVal }));

  const onDeleteProp = (prop: string) =>
    setEditedObj((obj) => {
      const filteredEntries = Object.entries(obj).filter(([k]) => k !== prop);
      return Object.fromEntries(filteredEntries) as typeof obj;
    });

  useEffect(() => {
    if ("tag" in editedObj || "-tag" in editedObj) {
      const thisProp = "tag" in editedObj ? "tag" : ("-tag" in editedObj ? "-tag" : "");
      const pluralProp = toggleSingularPlural(thisProp);
      setEditedObj((obj) => {
        const filteredEntries = Object.entries(obj).filter(
          ([k]) => k !== thisProp
        );
        const newObj = Object.fromEntries(filteredEntries) as typeof obj;
        (newObj as any)[pluralProp] = [
          editedObj[thisProp] as string,
          ...((editedObj?.[pluralProp] as string[]) || []),
        ];
        return newObj;
      });
    }
  }, ["tag" in editedObj, "-tag" in editedObj]);

  const isBacklog = "backlog" in editedObj && editedObj.backlog;
  useEffect(() => {
    if (isBacklog && Object.keys(editedObj).length > 2) {
      setEditedObj((obj) => {
        const filteredEntries = Object.entries(obj).filter(
          ([k]) => k === "backlog" || k === "name"
        );
        const newObj = Object.fromEntries(filteredEntries) as typeof obj;
        return newObj;
      });
    }
  }, [isBacklog, Object.keys(editedObj).length]);

  const outObjEntries = Object.entries(editedObj)
    .map(([prop, val]) => {
      if ((prop === "tags" || prop === "-tags") && val.length === 1) {
        const thisProp = prop === "tags" ? "tags" : (prop === "-tags" ? "-tags" : "");
        const singularProp = toggleSingularPlural(thisProp);
        return [singularProp, val[0]];
      }
      return [prop, val]
    })
    .filter(([_, val]) => val !== "" && val !== null && val !== []);
  const outObj = Object.fromEntries(outObjEntries);
  const outConf =
    editedColIdx === null
      ? {
          ...inputConfig,
          [editedKey]: outObj,
        }
      : {
          ...inputConfig,
          columns: [
            ...inputConfig.columns.slice(0, editedColIdx),
            outObj,
            ...inputConfig.columns.slice(editedColIdx + 1),
          ],
        };
  const yamlConfig = yaml.dump(outConf);

  return { yamlConfig, onPropChange, onDeleteProp, editedObj };
}
