import { getNotebookPath, getNoteById } from "./noteData";

import rules from "./rules";
import { parseConfigNote } from "./parser";
import { Action } from "./actions";
import {
  NoteData,
  UpdateQuery,
  BoardState,
  Rule,
  Message,
  Config,
} from "./types";

interface Column {
  name: string;
  rules: Rule[];
}

/**
 * Class representing a kanban board instance.
 * Keeps track of the active configuration and rules.
 *
 * After creating an instance, call `loadConfig` with the yaml config string.
 * Until this method has been called, the board is invalid.
 *
 * An instance of this class is bound to a config note with a specific id
 * and location (it's name can change). If the config note is deleted or moved,
 * the board should be destroyed.
 */
export default class Board {
  /**
   * Inidicates whether the board's config was valid (can be rendered).
   * It is also false if `loadConfig` has't been called yet.
   */
  public isValid: boolean = false;

  /**
   * List of error messages to show in case of an invalid board.
   */
  public errorMessages: Message[] = [];

  /**
   * The raw yaml string. Empty until `loadConfig` is called.
   */
  public configYaml = "";

  /**
   * The name of the notebook which holds all notes on the board.
   * Empty until `loadConfig` is called.
   */
  public rootNotebookName = "";

  /**
   * List of tags that should not be displayed on cards. We include
   * tags here which are part of filters, because they would show up
   * on all cards (notes).
   */
  public hiddenTags: string[] = [];

  /**
   * Column names, in the order they should be displayed.
   */
  public columnNames: string[] = [];

  /**
   * The parsed dictionary form of the YAML config. Null if board is invalid
   * or `loadConfig` hasn't been called yet.
   */
  public parsedConfig: Config | null = null;

  private baseFilters: Rule[] = [];
  private allColumns: Column[] = [];
  private nonBacklogColumns: Column[] = [];
  private backlogColumn: Column | null = null;

  constructor(
    public readonly configNoteId: string,
    public readonly boardNotebookId: string,
    public boardName: string
  ) {}

  /**
   * Reset the properties of the board when an invalid config is loaded.
   */
  private reset() {
    this.rootNotebookName = "";
    this.hiddenTags = [];
    this.columnNames = [];
    this.errorMessages = [];
    this.parsedConfig = null;
  }

  /**
   * Load a new yaml config for this board.
   *
   * First validates the config, then initializes all rules and filters.
   *
   * **Warning**: rule initializers can have side effects (eg. creating missing tags),
   * but in all cases they should be idempotent.
   *
   * @returns true if config was valid, false otherwise
   */
  async loadConfig(configYaml: string): Promise<boolean> {
    this.configYaml = configYaml;
    const { config: configObj, error } = parseConfigNote(configYaml);
    if (!configObj) {
      this.isValid = false;
      this.errorMessages = [error as Message];
      return false;
    }
    this.reset();
    this.parsedConfig = configObj;
    this.isValid = true;

    // First, find out which notebook is the root
    const { rootNotebookPath = await getNotebookPath(this.boardNotebookId) } =
      configObj.filters || {};
    this.rootNotebookName = rootNotebookPath.split("/").pop() as string;

    this.baseFilters = [
      // Exclude the config note
      await rules.excludeNoteId(this.configNoteId, rootNotebookPath, configObj),
    ];

    // Restrict to root notebook
    if (rootNotebookPath !== "/") {
      this.baseFilters.push(
        await rules.notebookPath(rootNotebookPath, "", configObj)
      );
    }

    // Process filters
    this.hiddenTags = [];
    for (const key in configObj.filters) {
      let val = configObj.filters[key];
      if (typeof val === "boolean") val = `${val}`;
      if (val && key in rules) {
        const rule = await rules[key](val, rootNotebookPath, configObj);
        this.baseFilters.push(rule);
        if (key === "tag") this.hiddenTags.push(val as string);
        else if (key === "tags")
          this.hiddenTags = [...this.hiddenTags, ...(val as string[])];
      }
    }

    // Process columns
    this.backlogColumn = null;
    this.allColumns = [];
    this.nonBacklogColumns = [];
    for (const col of configObj.columns) {
      const newCol: Column = {
        name: col.name,
        rules: [],
      };
      this.columnNames.push(col.name)
      this.allColumns.push(newCol);

      if (col.backlog) {
        // Backlog column can have no rules
        this.backlogColumn = newCol;
      } else {
        for (const key in col) {
          let val = col[key];
          if (typeof val === "boolean") val = `${val}`;
          if (val && key in rules) {
            const rule = await rules[key](val, rootNotebookPath, configObj);
            newCol.rules.push(rule);
            if (key === "tag") this.hiddenTags.push(val as string);
            else if (key === "tags")
              this.hiddenTags = [...this.hiddenTags, ...(val as string[])];
          }
        }
        this.nonBacklogColumns.push(newCol);
      }
    }

    return true;
  }

  /**
   * Check which column the given note belongs to.
   * Return its name or null if none of them.
   * If multiple columns could match, return the first (leftmost) one.
   */
  sortNoteIntoColumn(note: NoteData): string | null {
    const matchesBaseFilters = this.baseFilters.every((r) =>
      r.filterNote(note)
    );
    if (matchesBaseFilters) {
      const foundCol = this.nonBacklogColumns.find(({ rules }) =>
        rules.every(({ filterNote }) => filterNote(note))
      );
      if (foundCol) return foundCol.name;
      if (this.backlogColumn) return this.backlogColumn.name;
    }

    return null;
  }

  /**
   * Check whether the given note is on the board.
   */
  async isNoteIdOnBoard(id: string): Promise<boolean> {
    if (!this.isValid) return false;
    const note = await getNoteById(id);
    if (!note) return true;
    return this.sortNoteIntoColumn(note) !== null;
  }

  /**
   * Given a list of all notes in the notebook, return the latest board state,
   * i.e. sorted columns, messages, and hidden tags.
   */
  async getBoardState(allNotes: NoteData[]): Promise<BoardState> {
    const config = this.parsedConfig;
    const state: BoardState = {
      name: this.boardName,
      messages: [],
      hiddenTags: [],
    };

    if (this.isValid) {
      const sortedNotes: { [col: string]: NoteData[] } = {};
      this.columnNames.forEach((n) => (sortedNotes[n] = []));
      for (const note of allNotes) {
        const colName = this.sortNoteIntoColumn(note);
        if (colName) sortedNotes[colName].push(note);
      }

      const sortedColumns: BoardState["columns"] = Object.entries(
        sortedNotes
      ).map(([name, notes]) => ({ name, notes }));

      let sortCol = config ? config.sort?.by : undefined;
      let sortDir = 1;
      if (sortCol !== undefined) {
        if (sortCol.startsWith('-')) {
          sortDir = -1;
          sortCol = sortCol.substring(1);
        }
      }
      Object.values(sortedColumns).forEach((col) =>
        col.notes.sort((a, b) => {
          if (sortCol !== undefined) {
            const va = (a as any)[sortCol];
            const vb = (b as any)[sortCol];
            const v = (
                (typeof va === "string")
                  ? va.toLocaleLowerCase().localeCompare(vb.toLocaleLowerCase())
                  : va - vb
            );
            return v * sortDir;
          }

          // Otherwise, use user-order specified on Kanban board
          if (a.order < b.order) return +1;
          if (a.order > b.order) return -1;
          return a.createdTime < b.createdTime ? +1 : -1;
        })
      );
      state.columns = sortedColumns;
      state.hiddenTags = this.hiddenTags;
    } else {
      state.messages = this.errorMessages;
    }

    return state;
  }

  /**
   * Based on an action, get a list of update queries needed to update the note database
   * so that the board reached the desired state.
   *
   * Return an empty list if can't handle the action type.
   */
  getBoardUpdate(action: Action, boardState: BoardState) {
    switch (action.type) {
      case "newNote":
        const col = this.allColumns.find(
          ({ name }) => name === action.payload.colName
        ) as Column;
        const hasNotebookPathRule =
          col.rules.find((r) => r.name === "notebookPath") !== undefined;
        return [
          ...this.baseFilters
            .filter((r) => !hasNotebookPathRule || r.name !== "notebookPath")
            .flatMap((r) => r.set(action.payload.noteId || "")),
          ...col.rules.flatMap((r) => r.set(action.payload.noteId || "")),
        ];

      case "moveNote":
        const { noteId, newColumnName, oldColumnName, newIndex } =
          action.payload;
        const newCol = this.allColumns.find(
          ({ name }) => name === newColumnName
        ) as Column;
        const oldCol = this.allColumns.find(
          ({ name }) => name === oldColumnName
        ) as Column;

        const unsetQueries = oldCol.rules.flatMap((r) => r.unset(noteId));
        const setQueries = newCol.rules.flatMap((r) => r.set(noteId));
        const queries: UpdateQuery[] = [...unsetQueries, ...setQueries];

        const setOrder = (note: string, order: number) =>
          queries.push({
            type: "put",
            path: ["notes", note],
            body: { order },
          });
        const notesInCol = boardState.columns?.find(
          (col) => col.name === newColumnName
        )?.notes as NoteData[];
        const notes = notesInCol.filter((note) => note.id !== noteId);
        if (notes.length > 0) {
          if (newIndex === 0) {
            setOrder(noteId, notes[0].order + 1);
          } else if (newIndex >= notes.length) {
            setOrder(noteId, notes[notes.length - 1].order - 1);
          } else {
            const newOrder = notes[newIndex - 1].order - 1;
            setOrder(noteId, newOrder);
            const notesAfter = notesInCol.slice(newIndex);
            notesAfter.forEach(
              (note, idx) =>
                note.id !== noteId && setOrder(note.id, newOrder - 1 - idx)
            );
          }
        }

        return queries;
    }

    return [];
  }
}
