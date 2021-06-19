import { Config, DataQuery } from "./board";
import { getTagId } from "./noteData";

export interface Rule {
  searchQueries: string[];
  set(noteId: string): DataQuery[];
  unset(noteId: string): DataQuery[];
}

export type RuleFactory = (
  ruleValue: string | string[],
  config: Config
) => Promise<Rule>;

type Rules = { [ruleName: string]: RuleFactory };

const rules: Rules = {
  async tag(tagName: string | string[]) {
    if (Array.isArray(tagName)) tagName = tagName[0];
    const tagID = await getTagId(tagName);
    return {
      searchQueries: [`tag:${tagName}`],
      set: (noteId: string) => ([{
        type: "post",
        path: ["tags", tagID, "notes"],
        body: { id: noteId },
      }]),
      unset: (noteId: string) => ([{
        type: "delete",
        path: ["tags", tagID, "notes", noteId],
      }]),
    };
  },
};

export default rules;
