export interface Tag {
  id: string;
  name: string;
}

export interface Notebook {
  id: string;
  name?: string;
}

export interface BoardNoteData {
  id: string;
  title: string;
  parent_id: string;
  body: string;
}

export interface RawConfig {
  filters: {
    [ruleName: string]: string | string[];
    rootNotebookPath: string;
  };
  columns: {
    [ruleName: string]: string | string[] | boolean | undefined;
    name: string;
    backlog?: boolean;
  }[];
}

export interface NoteData {
  id: string;
  title: string;
  tags: Tag[];
  notebook: Notebook;
  isTodo: boolean;
  isCompleted: boolean;
}

export interface DataQuery {
  method: "post" | "delete" | "put";
  path: string[];
  body?: any;
}

export interface Rule {
  searchQueries: string[];
  set(note: NoteData): DataQuery;
  unset(note: NoteData): DataQuery;
}

export type RuleFactory = (
  ruleValue: string | string[],
  rawConfig: RawConfig
) => Promise<Rule>;

export interface ColumnConfig {
  name: string;
  rules: Rule[];
  backlog: boolean;
}

export interface BoardConfig {
  boardName: string;
  rootNotebook: Notebook;
  filters: Rule[];
  columns: ColumnConfig[];
}

export interface SortedColumn {
  name: string;
  notes: NoteData[];
}

export interface BoardState {
  boardName: string;
  sortedColumns: SortedColumn[];
}
