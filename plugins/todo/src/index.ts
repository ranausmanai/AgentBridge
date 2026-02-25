import type { Plugin } from '@agentbridge/core';
import { definePlugin } from '@agentbridge/sdk';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface TodoItem {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

const TODO_FILE = join(homedir(), '.agentbridge-todos.json');

function loadTodos(): TodoItem[] {
  if (!existsSync(TODO_FILE)) return [];
  try {
    return JSON.parse(readFileSync(TODO_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTodos(todos: TodoItem[]): void {
  writeFileSync(TODO_FILE, JSON.stringify(todos, null, 2));
}

function nextId(todos: TodoItem[]): number {
  return todos.length === 0 ? 1 : Math.max(...todos.map(t => t.id)) + 1;
}

const plugin: Plugin = definePlugin({
  name: 'todo',
  description: 'Manage a personal todo list — add, list, complete, and delete tasks',
  version: '0.1.0',
  actions: [
    {
      name: 'add_todo',
      description: 'Add a new item to the todo list',
      parameters: z.object({
        text: z.string().describe('The todo item text'),
      }),
      execute: async ({ text }) => {
        const todos = loadTodos();
        const item: TodoItem = {
          id: nextId(todos),
          text,
          done: false,
          createdAt: new Date().toISOString(),
        };
        todos.push(item);
        saveTodos(todos);
        return {
          success: true,
          message: `Added todo #${item.id}: "${text}"`,
          data: item,
        };
      },
    },
    {
      name: 'list_todos',
      description: 'List all todo items, optionally filtering by status',
      parameters: z.object({
        filter: z.enum(['all', 'pending', 'done']).default('all').describe('Filter by status'),
      }),
      execute: async ({ filter }) => {
        let todos = loadTodos();
        if (filter === 'pending') todos = todos.filter(t => !t.done);
        if (filter === 'done') todos = todos.filter(t => t.done);

        if (todos.length === 0) {
          return { success: true, message: filter === 'all' ? 'Your todo list is empty.' : `No ${filter} todos.` };
        }

        const lines = todos.map(t => {
          const status = t.done ? '[x]' : '[ ]';
          return `${status} #${t.id}: ${t.text}`;
        }).join('\n');

        return {
          success: true,
          message: `Your todos:\n${lines}`,
          data: todos,
        };
      },
    },
    {
      name: 'complete_todo',
      description: 'Mark a todo item as completed',
      parameters: z.object({
        id: z.number().describe('The todo item ID to mark as done'),
      }),
      execute: async ({ id }) => {
        const todos = loadTodos();
        const item = todos.find(t => t.id === id);
        if (!item) return { success: false, message: `Todo #${id} not found.` };
        if (item.done) return { success: true, message: `Todo #${id} is already done.` };
        item.done = true;
        saveTodos(todos);
        return { success: true, message: `Completed todo #${id}: "${item.text}"`, data: item };
      },
    },
    {
      name: 'delete_todo',
      description: 'Delete a todo item from the list',
      parameters: z.object({
        id: z.number().describe('The todo item ID to delete'),
      }),
      execute: async ({ id }) => {
        const todos = loadTodos();
        const idx = todos.findIndex(t => t.id === id);
        if (idx === -1) return { success: false, message: `Todo #${id} not found.` };
        const [removed] = todos.splice(idx, 1);
        saveTodos(todos);
        return { success: true, message: `Deleted todo #${id}: "${removed.text}"`, data: removed };
      },
    },
  ],
});

export default plugin;
