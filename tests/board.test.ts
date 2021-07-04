import createBoard, { Board } from "../src/board";

jest.mock("../src/noteData", () => ({
  getTagId: jest.fn((t) => t),
  resolveNotebookPath: jest.fn((n) => n),
}));

const fenceConf = (s: string) => "```kanban\n" + s + "\n```";

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
  rootNotebookPath: "test/nested test"
  tag: task
`;
const testConfigBody = fenceConf(testConfig);

const mockTime = 1624713576;

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
      parent_id: "id",
    });
    expect(board).toBe(null);
  });

  it("should return null if there is a kanban config section, but it's invalid", async () => {
    const board = await createBoard({
      id: "testid",
      title: "testname",
      body: fenceConf("notakanbanboard: true"),
      parent_id: "id",
    });
    expect(board).toBe(null);
  });

  it("should set configNoteId and boardName", async () => {
    const configNoteId = "testid";
    const boardName = "testname";
    const board = (await createBoard({
      id: configNoteId,
      title: boardName,
      body: testConfigBody,
      parent_id: "id",
    })) as Board;
    expect(board.configNoteId).toBe(configNoteId);
    expect(board.boardName).toBe(boardName);
  });

  describe("allNotesQuery", () => {
    it("should contain queries for all filter rules", async () => {
      const configNoteId = "testid";
      const boardName = "testname";
      const board = (await createBoard({
        id: configNoteId,
        title: boardName,
        body: testConfigBody,
        parent_id: "id",
      })) as Board;
      expect(board.allNotesQuery.filters).toContain(
        "notebookid:test/nested test"
      );
      expect(board.allNotesQuery.filters).toContain("tag:task");
    });
  });

  describe("columnQueries", () => {
    it("should contain rule for each column", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: "id",
      })) as Board;

      expect(board.columnQueries.length).toBe(4);
    });

    it("every search query should contain the filter queries", async () => {
      const board = (await createBoard({
        id: "testid",
        title: "testname",
        body: testConfigBody,
        parent_id: "id",
      })) as Board;

      board.columnQueries.forEach(({ query: { filters } }) => {
        expect(filters).toContain(board.allNotesQuery.filters);
      });
    });

    describe("backlog rule", () => {
      it("should emit filters of all other rules negated", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: "id",
        })) as Board;

        const backlogQuery = board.columnQueries[0].query.filters;
        expect(backlogQuery).toContain("-tag:ready");
        expect(backlogQuery).toContain('-notebook:"working"');
        expect(backlogQuery).toContain("-iscompleted:1");
        expect(backlogQuery).toContain("-tag:done");
      });
    });

    describe("tag rule", () => {
      it("should emit tag filter", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: "id",
        })) as Board;

        expect(board.columnQueries[1].query.filters).toContain("tag:ready");
      });
    });

    describe("tags rule", () => {
      it("should emit tag filter for each tag in the list", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: "id",
        })) as Board;

        expect(board.columnQueries[3].query.filters).toContain("tag:done");
        expect(board.columnQueries[3].query.filters).toContain("tag:completed");
      });
    });

    describe("notebook rule", () => {
      it("should emit notebook filter", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: "id",
        })) as Board;

        expect(board.columnQueries[2].query.filters).toContain(
          'notebook:"working"'
        );
      });
    });

    describe("completed rule", () => {
      it("should emit completed filter", async () => {
        const board = (await createBoard({
          id: "testid",
          title: "testname",
          body: testConfigBody,
          parent_id: "id",
        })) as Board;

        expect(board.columnQueries[3].query.filters).toContain("iscompleted:1");
      });
    });
  });

  describe("actionToQuery", () => {
    describe("moveNote action", () => {
      describe("unset rules", () => {
        it("should emit update to unset tag", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Ready for review",
              newColumnName: "Working",
            },
          });

          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "ready", "notes", "noteid"],
          });
        });

        it("should emit update to unset multiple tags", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Done",
              newColumnName: "Working",
            },
          });

          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "done", "notes", "noteid"],
          });
          expect(update).toContainEqual({
            type: "delete",
            path: ["tags", "completed", "notes", "noteid"],
          });
        });

        it("should NOT emit update to unset notebook", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Working",
              newColumnName: "Backlog",
            },
          });

          expect(update.length).toBe(0);
        });

        it("should emit update to unset completed", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Done",
              newColumnName: "Working",
            },
          });

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", "noteid"],
            body: {
              completed: 0,
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
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Backlog",
              newColumnName: "Ready for review",
            },
          });

          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "ready", "notes"],
            body: { id: "noteid" },
          });
        });

        it("should emit update to set multiple tags", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Working",
              newColumnName: "Done",
            },
          });

          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "done", "notes"],
            body: { id: "noteid" },
          });
          expect(update).toContainEqual({
            type: "post",
            path: ["tags", "completed", "notes"],
            body: { id: "noteid" },
          });
        });

        it("should emit update to set notebook", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Backlog",
              newColumnName: "Working",
            },
          });

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", "noteid"],
            body: { parent_id: "working" },
          });
        });

        it("should emit update to set completed", async () => {
          const board = (await createBoard({
            id: "testid",
            title: "testname",
            body: testConfigBody,
            parent_id: "id",
          })) as Board;

          const update = board.actionToQuery({
            type: "moveNote",
            payload: {
              noteId: "noteid",
              oldColumnName: "Working",
              newColumnName: "Done",
            },
          });

          expect(update).toContainEqual({
            type: "put",
            path: ["notes", "noteid"],
            body: {
              completed: mockTime,
            },
          });
        });
      });
    });
  });
});
