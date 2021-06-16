import { Config, DataQuery } from "./board";
import { getTagId, NoteData } from "./noteData";

export interface Rule {
  searchQueries: string[];
  set(note: NoteData): DataQuery;
  unset(note: NoteData): DataQuery;
}

export type RuleFactory = (
  ruleValue: string | string[],
  rawConfig: Config
) => Promise<Rule>;

type Rules = { [ruleName: string]: RuleFactory };

const rules: Rules = {
  async tag(tagName: string | string[]) {
    if (Array.isArray(tagName)) tagName = tagName[0];
    const tagID = await getTagId(tagName);
    return {
      searchQueries: [`tag:${tagName}`],
      set: ({ id }: NoteData) => ({
        method: "post",
        path: ["tags", tagID, "notes"],
        body: { id },
      }),
      unset: ({ id }: NoteData) => ({
        method: "delete",
        path: ["tags", tagID, "notes", id],
      }),
    };
  },
};

export default rules;
