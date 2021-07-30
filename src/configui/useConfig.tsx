import { useState, useMemo } from "react";
import * as yaml from "js-yaml";

import type { Config, RuleValue } from "../board";

export default function (editedPath: string, inputConfig: Config) {
  const [config, setConfig] = useState(inputConfig);

  const [editedKey, editedColName = null] = editedPath.split(".", 2) as [
    keyof Config,
    string?
  ];
  const editedColIdx = useMemo(() => {
    const idx =
      editedColName === null
        ? null
        : config.columns.findIndex((c) => c.name === editedColName);
    if (idx === -1) throw new Error(`Invalid column name: ${editedColName}`);
    return idx;
  }, [editedColName]);

  const editedObj =
    editedColIdx === null ? config[editedKey] || {} : config.columns[editedColIdx];

  const editObj = (conf: typeof config, cb: <T>(o: T) => T) =>
    editedColIdx === null
      ? {
          ...conf,
          [editedKey]: cb(conf[editedKey]),
        }
      : {
          ...conf,
          columns: [
            ...conf.columns.slice(0, editedColIdx),
            cb(conf.columns[editedColIdx]),
            ...conf.columns.slice(editedColIdx + 1),
          ],
        };

  const onPropChange = (prop: string, newVal: RuleValue) =>
    setConfig((conf) => editObj(conf, (o) => ({ ...o, [prop]: newVal })));

  const onDeleteProp = (prop: string) =>
    setConfig((conf) =>
      editObj(conf, (o) => {
        const filteredEntries = Object.entries(o).filter(([k]) => k !== prop);
        return Object.fromEntries(filteredEntries) as typeof o;
      })
    );

  if ("tag" in editedObj) {
    setConfig((conf) =>
      editObj(conf, (o) => {
        const filteredEntries = Object.entries(o).filter(([k]) => k !== "tag");
        const newObj = Object.fromEntries(filteredEntries) as typeof o;
        (newObj as any).tags = [
          editedObj.tag as string,
          ...((editedObj?.tags as string[]) || []),
        ];
        return newObj;
      })
    );
  }

  const outObjEntries = Object.entries(editedObj)
    .map(([prop, val]) =>
      prop === "tags" && val.length === 1 ? ["tag", val[0]] : [prop, val]
    )
    .filter(([_, val]) => val !== "" && val !== null && val !== []);
  const outObj = Object.fromEntries(outObjEntries);
  const outConf = editObj(config, () => outObj);
  const yamlConfig = yaml.dump(outConf);

  return { yamlConfig, onPropChange, onDeleteProp, editedObj };
}
