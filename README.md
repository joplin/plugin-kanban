# Joplin Kanban Plugin

This a plugin for the note taking app [Joplin](https://joplinapp.org/), which adds a flexible kanban board view for your notes, to help you organize your tasks.

![screenshot](images/kanban-screenshot.png)

## Installation

In Joplin, go to Tools > Options, then on the left select Plugins, search for "kanban" and click install. You can read more about Joplin plugins [here](https://joplinapp.org/plugins/).

## Usage

To get started, you'll need a notebook which will contain all tasks that you want to see on the board. The plugin will only show tasks in a single notebook and it's sub-notebooks.

A kanban board is defined by a special type of note, which contains all of its configuration. Create a new note, and paste in the following:

    ```kanban
    columns:
      - name: Backlog
        backlog: true
      - name: Work in progress
        tag: wip
      - name: Finished
        tag: done
    ```

It is important that the confiuration is surrounded by a code block (` ```kanban ... ``` `), otherwise it won't be detected.

After pasting the configuration, you might have to switch to a different note, then back, but then you should immediately see a kanban view pop up on the right. It should contain all notes in the notebook, sorted into columns. You can drag the notes around and see that their tags are updated.

If you switch to a different note that's on the board, the kanban should stay visible. But if you switch to another notebook, or restart Joplin, you'll need to first open the note which contains the configuration again.

## Configuration

There are two ways to configure a kanban board: the YAML based text config ([a quick intro on YAML](https://learnxinyminutes.com/docs/yaml/)), that you see above, or the config dialog. The options available are the same with both methods.

### Columns

You can have any number of columns on your kanban board. A column is defined by its name (which must be unique) and a list of rules. These rules determine what notes show up in the given column. If _any one_ of the rules matches, the note is sorted into the column. Here's the list of supported rules:

* `tag: ...` Matches if the note has the given tag. If the tag doesn't exist, it is created automatically. You can also use `tags` to define a list tags.
* `notebookPath: ...` Matches if the note is in the notebook, defined by the path. You can read more about notebook paths below, in the filters section.
* `completed: true` Matches if the note is a todo and is marked as done. You can also use `completed: false` to match uncompleted todos.
* `backlog: true` Matches if the note doesn't fit into any other column. You can use this to collect all your unmarked notes.

You can edit these rules via the config dialog, by double clicking the column name.

### Filters

Filters are rules which define what notes should be visible on your board. For example, with the following config only notes with a `task` tag will show up on the kanban view:

```yaml
```kanban
filters:
  tag: task
columns:
...
```

Filters can contain the same rules as columns, except for the `rootNotebookPath` property. This defines the notebook from which notes are displayed on the board. By default, it is the parent notebook of the config note, but you can set it to anything. It's a `/` separated path so with a notebook structure like

```
Parent/
├─ Nested Parent/
│  ├─ Kanban board/
```

To give the path to `Kanban board` you should write `"Parent/Nested Parent/Kanban board"`

To edit the filters via the config dialog, click the gear icon next to the board name.

### Display

The kanban plugin automatically creates a static table view of your board on the configuration card. This is useful when you want to view your kanban board on a mobile device (which don't support plugins). You can change this to display as a list. 

```yaml
```kanban
filters:
  tag: task
columns:
...
display:
  markdown: list
```

Visual examples and more info: https://github.com/joplin/plugin-kanban/pull/19

### Sort

By default, the kanban plugin sorts each column based on the user's dragging and dropping of notes across the kanban board, with new notes going at the top. To specify a fixed sort pattern based on note properties instead, use the following config:

```yaml
```kanban
sort:
  by: title
```

Descending sort order may be specified by prefixing `-`, e.g., `-title`.

The configured sort order will apply to all columns.

## Further information

If you want to know more about the workings of the plugin or its development check out the [original proposal](https://discourse.joplinapp.org/t/kanban-board-project/17469) and the [progress reports](https://discourse.joplinapp.org/t/kanban-board-project/17469)

