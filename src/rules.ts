import { RuleFactory, NoteData } from "./types";
import { getTagId } from "./noteData";

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
