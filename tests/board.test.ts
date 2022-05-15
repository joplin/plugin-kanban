import type { LazyNoteData } from "../src/noteData";
import type { NoteData } from "../src/types";
import Board from "../src/board";
import { getYamlConfig } from "../src/parser";

let mockSearchRes: NoteData[][] = [];

jest.mock("../src/noteData", () => ({
  search: jest.fn(
    (): LazyNoteData[] =>
      mockSearchRes.shift()?.map(
        (data) =>
          ({
            data,
            _tags: data.tags,
            knownTags: data.tags,
            loadTags: () => undefined,
            hasTag: (tag: string) => data.tags.includes(tag),
            fullyLoadData: () => data,
          } as unknown as LazyNoteData)
      ) ?? []
  ),
  getNoteById: jest.fn(() => {}),
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
    completedNotebook: done
    completedTag: done
    tags:
       - done
       - completed
    name: Done
filters: 
  rootNotebookPath: "${parentNb}"
  tag: task
`;
const fenceConf = (s: string) => "```kanban\n" + s + "\n```";
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

const note = (data: NoteData) =>
  ({
    data,
    _tags: data.tags,
    knownTags: data.tags,
    loadTags: () => undefined,
    hasTag: (tag: string) => data.tags.includes(tag),
    fullyLoadData: () => data,
  } as unknown as LazyNoteData);

describe("Board", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;
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

  it("should return errors if there is a kanban config section, but it's invalid", async () => {
    const board = await createBoard({
      id: "testid",
      title: "testname",
      body: fenceConf("notakanbanboard: true"),
      parent_id: parentNb,
    });
    expect(board?.errorMessages?.length).toBeGreaterThan(0);
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

      const col1 = await board.sortNoteIntoColumn(
        note({
          id: "id",
          title: "",
          notebookId: "someid",
          tags: ["task"],
          isCompleted: false,
          isTodo: false,
          due: 0,
          order: 0,
          createdTime: mockTime,
        })
      );
      expect(col1).toBe(null);

      const col2 = await board.sortNoteIntoColumn(
        note({
          id: "id",
          title: "",
          notebookId: parentNb,
          tags: [],
          isCompleted: false,
          isTodo: false,
          due: 0,
          order: 0,
          createdTime: mockTime,
        })
      );
      expect(col2).toBe(null);
    });

    it("should give null for the board note", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: parentNb,
      })) as Board;

      const col1 = await board.sortNoteIntoColumn(
        note({
          id: "testid",
          title: "",
          notebookId: parentNb,
          tags: ["task"],
          isCompleted: false,
          isTodo: false,
          due: 0,
          order: 0,
          createdTime: mockTime,
        })
      );
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

        const col1 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: parentNb,
            tags: ["task"],
            isCompleted: false,
            isTodo: false,
            due: 0,
            order: 0,
            createdTime: mockTime,
          })
        );
        expect(col1).toBe("Backlog");

        const col2 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: `${parentNb}/child1`,
            tags: ["task", "sometag"],
            isCompleted: false,
            isTodo: true,
            due: 0,
            order: 0,
            createdTime: mockTime,
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

        const col1 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: parentNb,
            tags: ["task", "ready"],
            isCompleted: false,
            isTodo: false,
            due: 0,
            order: 0,
            createdTime: mockTime,
          })
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

        const col1 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: parentNb,
            tags: ["task", "done"],
            isCompleted: false,
            isTodo: false,
            due: 0,
            order: 0,
            createdTime: mockTime,
          })
        );
        expect(col1).toBe("Done");

        const col2 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: `${parentNb}/child1`,
            tags: ["task", "completed"],
            isCompleted: false,
            isTodo: false,
            due: 0,
            order: 0,
            createdTime: mockTime,
          })
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

        const col1 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: `${parentNb}/working`,
            tags: ["task"],
            isCompleted: false,
            isTodo: false,
            due: 0,
            order: 0,
            createdTime: mockTime,
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

        const col1 = await board.sortNoteIntoColumn(
          note({
            id: "id",
            title: "",
            notebookId: parentNb,
            tags: ["task"],
            isCompleted: true,
            isTodo: true,
            due: 0,
            order: 0,
            createdTime: mockTime,
          })
        );
        expect(col1).toBe("Done");
      });
    });
  });

  //   describe.skip("actionToQuery", () => {
  //     describe("moveNote action", () => {
  //       describe("unset rules", () => {
  //         it("should emit update to unset tag", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Ready for review",
  //               newColumnName: "Working",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "delete",
  //             path: ["tags", "ready", "notes", "noteid"],
  //           });
  //         });

  //         it("should emit update to unset multiple tags", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Done",
  //               newColumnName: "Working",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "delete",
  //             path: ["tags", "done", "notes", "noteid"],
  //           });
  //           expect(update).toContainEqual({
  //             type: "delete",
  //             path: ["tags", "completed", "notes", "noteid"],
  //           });
  //         });

  //         it("should emit update to unset notebook", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Working",
  //               newColumnName: "Backlog",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "put",
  //             path: ["notes", "noteid"],
  //             body: { parent_id: parentNb },
  //           });
  //         });

  //         it("should emit update to unset completed", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Done",
  //               newColumnName: "Working",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "put",
  //             path: ["notes", "noteid"],
  //             body: {
  //               todo_completed: 0,
  //             },
  //           });
  //         });
  //       });

  //       describe("set rules", () => {
  //         it("should emit update to set tag", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Backlog",
  //               newColumnName: "Ready for review",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "post",
  //             path: ["tags", "ready", "notes"],
  //             body: { id: "noteid" },
  //           });
  //         });

  //         it("should emit update to set multiple tags", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Working",
  //               newColumnName: "Done",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "post",
  //             path: ["tags", "done", "notes"],
  //             body: { id: "noteid" },
  //           });
  //           expect(update).toContainEqual({
  //             type: "post",
  //             path: ["tags", "completed", "notes"],
  //             body: { id: "noteid" },
  //           });
  //         });

  //         it("should emit update to set notebook", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Backlog",
  //               newColumnName: "Working",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "put",
  //             path: ["notes", "noteid"],
  //             body: { parent_id: `${parentNb}/working` },
  //           });
  //         });

  //         it("should emit update to set completed", async () => {
  //           const board = (await createBoard({
  //             id: "testid",
  //             title: "testname",
  //             body: testConfigBody,
  //             parent_id: parentNb,
  //           })) as Board;

  //           const update = board.actionToQuery({
  //             type: "moveNote",
  //             payload: {
  //               noteId: "noteid",
  //               oldColumnName: "Working",
  //               newColumnName: "Done",
  //             },
  //           });

  //           expect(update).toContainEqual({
  //             type: "put",
  //             path: ["notes", "noteid"],
  //             body: {
  //               todo_completed: mockTime,
  //             },
  //           });
  //         });
  //       });
  //     });
  //   });
});
