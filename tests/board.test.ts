import { getYamlConfig } from "../src/parser";
import Board from "../src/board";
import type { BoardState, NoteData } from "../src/types";

jest.mock("../src/noteData", () => ({
  getTagId: jest.fn((t) => t),
  resolveNotebookPath: jest.fn((n) => n),
  getNotebookPath: jest.fn((n) => n),
  findAllChildrenNotebook: jest.fn((n) => [
    `${n}/working`,
    `${n}/child1`,
    `${n}/child2`,
  ]),
  createTag: jest.fn((t) => t),
  createNotebook: jest.fn((n) => n),
}));

const fenceConf = (s: string) => "```kanban\n" + s + "\n```";

const nbName = "nested test";
const parentNb = `test/${nbName}`;
const testConfig = `
columns: 
  - 
    backlog: true
    name: Backlog
  - 
    name: "Ready for review"
    tag: ready
  - 
    name: Working
    notebookPath: working
  - 
    completed: true
    tags:
       - done
       - completed
    name: Done
filters: 
  rootNotebookPath: "${parentNb}"
  tag: task
`;
const testConfigBody = fenceConf(testConfig);

const mockTime = 1624713576;

const createBoard = async ({
  id,
  title,
  body,
  parent_id,
}: {
  id: string;
  title: string;
  body: string;
  parent_id: string;
}) => {
  const board = new Board(id, parent_id, title);
  const config = getYamlConfig(body);
  if (!config) return null;
  await board.loadConfig(config);
  return board;
};

const note = (args: Partial<NoteData> = {}): NoteData => ({
  id: "id",
  title: "title",
  notebookId: parentNb,
  notebookData: {
    id: parentNb,
    title: "notebook",
    icon: { emoji: "☢️" },
    parent_id: ""
  },
  tags: ["task"],
  createdTime: mockTime,
  due: 0,
  isCompleted: false,
  isTodo: false,
  order: 0,
  ...args,
});

const state = (
  backlog: NoteData[] = [note({ id: "1" })],
  ready: NoteData[] = [note({ id: "2", tags: ["task", "ready"] })],
  working: NoteData[] = [note({ id: "3", notebookId: `${parentNb}/working` })],
  done: NoteData[] = [note({ id: "4", tags: ["task", "done"] })]
): BoardState => ({
  hiddenTags: [],
  messages: [],
  name: "testnote",
  columns: [
    { name: "Backlog", notes: backlog },
    { name: "Ready for review", notes: ready },
    { name: "Working", notes: working },
    { name: "Done", notes: done },
  ],
  displayConfig: {},
});

describe("Board", () => {
  let dateNowSpy: jest.SpyInstance;
  beforeAll(() => {
    dateNowSpy = jest.spyOn(Date, "now").mockImplementation(() => mockTime);
  });

  afterAll(() => {
    dateNowSpy.mockRestore();
  });

  it("should return null if there is no kanban config section", async () => {
    const board = await createBoard({
      id: "testid",
      title: "testname",
      body: "invalid config",
      parent_id: parentNb,
    });
    expect(board).toBe(null);
  });

  it("should return error message if there is a kanban config section, but it's invalid", async () => {
    const board = await createBoard({
      id: "testid",
      title: "testname",
      body: fenceConf("notakanbanboard: true"),
      parent_id: parentNb,
    });
    expect(board?.errorMessages.length).toBeGreaterThan(0);
  });

  it("should set configNoteId and boardName", async () => {
    const configNoteId = "testid";
    const boardName = "testname";
    const board = (await createBoard({
      id: configNoteId,
      title: boardName,
      body: testConfigBody,
      parent_id: parentNb,
    })) as Board;
    expect(board.configNoteId).toBe(configNoteId);
    expect(board.boardName).toBe(boardName);
  });

  it("should set rootNotebookName", async () => {
    const configNoteId = "testid";
    const boardName = "testname";
    const board = (await createBoard({
      id: configNoteId,
      title: boardName,
      body: testConfigBody,
      parent_id: parentNb,
    })) as Board;
    expect(board.rootNotebookName).toBe(nbName);
  });

  describe("columnNames", () => {
    it("should contain name of each column", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: parentNb,
      })) as Board;

      expect(board.columnNames.length).toBe(4);
    });
  });

  describe("sortNoteIntoColumn", () => {
    it("should give null for notes not on the board", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: parentNb,
      })) as Board;

      const col1 = board.sortNoteIntoColumn(note({ notebookId: "someid" }));
      expect(col1).toBe(null);

      const col2 = board.sortNoteIntoColumn(note({ tags: [] }));
      expect(col2).toBe(null);
    });

    it("should give null for the board note", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: parentNb,
      })) as Board;

      const col1 = board.sortNoteIntoColumn(note({ id: "testid" }));
      expect(col1).toBe(null);
    });

    describe("backlog rule", () => {
      it("should put all notes here which don't fit anywhere else", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: parentNb,
        })) as Board;

        const col1 = board.sortNoteIntoColumn(note());
        expect(col1).toBe("Backlog");

        const col2 = board.sortNoteIntoColumn(
          note({
            notebookId: `${parentNb}/child1`,
            tags: ["task", "sometag"],
            isTodo: true,
            isCompleted: false,
          })
        );
        expect(col2).toBe("Backlog");
      });
    });

    describe("tag rule", () => {
      it("match all notes with given tag", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: parentNb,
        })) as Board;

        const col1 = board.sortNoteIntoColumn(
          note({ tags: ["task", "ready"] })
        );
        expect(col1).toBe("Ready for review");
      });
    });

    describe("tags rule", () => {
      it("match all notes with at least one of the given tags", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: parentNb,
        })) as Board;

        const col1 = board.sortNoteIntoColumn(note({ tags: ["task", "done"] }));
        expect(col1).toBe("Done");

        const col2 = board.sortNoteIntoColumn(
          note({ tags: ["task", "completed"] })
        );
        expect(col2).toBe("Done");
      });
    });

    describe("notebook rule", () => {
      it("match all notes within the given notebook and children notebooks", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: parentNb,
        })) as Board;

        const col1 = board.sortNoteIntoColumn(
          note({
            notebookId: `${parentNb}/working`,
          })
        );
        expect(col1).toBe("Working");
      });
    });

    describe("completed rule", () => {
      it("match all completed todos", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: parentNb,
        })) as Board;

        const col1 = board.sortNoteIntoColumn(
          note({
            isCompleted: true,
            isTodo: true,
          })
        );
        expect(col1).toBe("Done");
      });
    });
  });

  describe("getBoardUpdate", () => {
    describe("moveNote action", () => {
      describe("unset rules", () => {
        it("should emit update to unset tag", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "2";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Ready for review",
                newColumnName: "Working",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "ready", "notes", noteId],
          });
        });

        it("should emit update to unset multiple tags", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "4";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Done",
                newColumnName: "Working",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "done", "notes", noteId],
          });
          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "completed", "notes", noteId],
          });
        });

        it("should emit update to unset notebook", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "3";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Working",
                newColumnName: "Backlog",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: { parent_id: parentNb },
          });
        });

        it("should emit update to unset completed", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "4";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Done",
                newColumnName: "Working",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: {
              todo_completed: 0,
            },
          });
        });
      });

      describe("set rules", () => {
        it("should emit update to set tag", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "1";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Backlog",
                newColumnName: "Ready for review",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "ready", "notes"],
            body: { id: noteId },
          });
        });

        it("should emit update to set multiple tags", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "3";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Working",
                newColumnName: "Done",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "done", "notes"],
            body: { id: noteId },
          });
          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "completed", "notes"],
            body: { id: noteId },
          });
        });

        it("should emit update to set notebook", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "1";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Backlog",
                newColumnName: "Working",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: { parent_id: `${parentNb}/working` },
          });
        });

        it("should emit update to set completed", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "3";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Working",
                newColumnName: "Done",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: {
              todo_completed: mockTime,
            },
          });
        });
      });

      describe("note order", () => {
        it("can put card on top", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "1";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Backlog",
                newColumnName: "Ready for review",
                newIndex: 0,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: { order: 1 },
          });
        });

        it("can put card on bottom", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state();

          const noteId = "1";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Backlog",
                newColumnName: "Ready for review",
                newIndex: 1,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: { order: -1 },
          });
        });

        it("can put card at any index", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: parentNb,
          })) as Board;
          const bs = state(undefined, [
            note({ id: "21", order: 2 }),
            note({ id: "22", order: 1 }),
            note({ id: "23", order: 0 }),
          ]);

          const noteId = "1";
          const update = board.getBoardUpdate(
            {
              type: "moveNote",
              payload: {
                noteId,
                oldColumnName: "Backlog",
                newColumnName: "Ready for review",
                newIndex: 1,
              },
            },
            bs
          );

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", noteId],
            body: { order: 1 },
          });
          expect(update).toContainEqual({
            type: "put",
            path: ["notes", "22"],
            body: { order: 0 },
          });
          expect(update).toContainEqual({
            type: "put",
            path: ["notes", "23"],
            body: { order: -1 },
          });
        });
      });
    });
  });
});
