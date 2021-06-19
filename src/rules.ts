import { Config } from "./board";
import { getTagId, ApiQuery } from "./noteData";

export interface Rule {
  searchQueries: string[];
  set(noteId: string): ApiQuery[];
  unset(noteId: string): ApiQuery[];
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
