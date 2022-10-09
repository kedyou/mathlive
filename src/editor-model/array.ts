import { Style } from '../public/core';

import { Atom } from '../core/atom';
import { GlobalContext } from '../core/context';

import { register as registerCommand } from '../editor/commands';

import type { ModelPrivate } from './model-private';
import { contentDidChange, contentWillChange } from './listeners';
import { arrayIndex, arrayCell } from './array-utils';
import { ArrayAtom } from '../core-atoms/array';
export * from './array-utils';

/**
 * Join all the cells at the indicated row into a single list of atoms
 */
export function arrayJoinColumns(
  context: GlobalContext,
  row: Atom[][],
  separator = ',',
  style?: Style
): Atom[] {
  if (!row) return [];
  const result: Atom[] = [new Atom('first', context)];
  let sep: Atom | null = null;
  for (let cell of row) {
    if (cell && cell.length > 0 && cell[0].type === 'first') {
      // Remove the 'first' atom, if present
      cell = cell.slice(1);
    }

    if (cell && cell.length > 0) {
      if (sep) result.push(sep);
      else sep = new Atom('mpunct', context, { value: separator, style });

      result.push(...cell);
    }
  }

  return result;
}

/**
 * Join all the rows into a single atom list
 */
export function arrayJoinRows(
  context: GlobalContext,
  array: Atom[][][],
  separators = [';', ','],
  style?: Style
): Atom[] {
  const result: Atom[] = [new Atom('first', context)];
  let sep: Atom | null = null;
  for (const row of array) {
    if (sep) result.push(sep);
    else sep = new Atom('mpunct', context, { value: separators[0], style });

    result.push(...arrayJoinColumns(context, row, separators[1]));
  }

  return result;
}

/**
 * Return the number of non-empty cells in that column
 */
export function arrayColumnCellCount(array: Atom[][][], col: number): number {
  let result = 0;
  const colRow = { col, row: 0 };
  while (colRow.row < array.length) {
    const cell = arrayCell(array, colRow);
    if (cell && cell.length > 0) {
      let cellLength = cell.length;
      if (cell[0].type === 'first') cellLength -= 1;
      if (cellLength > 0) result += 1;
    }

    colRow.row += 1;
  }

  return result;
}

/**
 * Remove the indicated column from the array
 */
export function arrayRemoveColumn(array: Atom[][][], col: number): void {
  let row = 0;
  while (row < array.length) {
    if (array[row][col]) array[row].splice(col, 1);

    row += 1;
  }
}

/**
 * Remove the indicated row from the array
 */
export function arrayRemoveRow(array: Atom[][][], row: number): void {
  array.splice(row, 1);
}

/**
 * Return the first non-empty cell, row by row
 */
export function arrayFirstCellByRow(array: Atom[][][]): string {
  const colRow = { col: 0, row: 0 };
  while (colRow.row < array.length && !arrayCell(array, colRow))
    colRow.row += 1;

  return arrayCell(array, colRow) ? `cell${arrayIndex(array, colRow)}` : '';
}

/**
 * Internal primitive to add a column/row in a matrix
 */
function addCell(
  model: ModelPrivate,
  where: 'after row' | 'before row' | 'after column' | 'before column'
): void {
  // This command is only applicable if we're in an ArrayAtom
  let atom = model.at(model.position);

  while (
    atom &&
    !(Array.isArray(atom.treeBranch) && atom.parent instanceof ArrayAtom)
  )
    atom = atom.parent!;

  if (Array.isArray(atom?.treeBranch) && atom?.parent instanceof ArrayAtom) {
    const arrayAtom = atom.parent;
    let pos: number;
    switch (where) {
      case 'after row':
        arrayAtom.addRowAfter(atom.treeBranch[0]);
        pos = model.offsetOf(arrayAtom.getCell(atom.treeBranch[0] + 1, 0)![0]);
        break;

      case 'after column':
        if (arrayAtom.maxColumns <= arrayAtom.colCount) {
          model.announce('plonk');
          return;
        }
        arrayAtom.addColumnAfter(atom.treeBranch[1]);
        pos = model.offsetOf(
          arrayAtom.getCell(atom.treeBranch[0], atom.treeBranch[1] + 1)![0]
        );
        break;

      case 'before row':
        arrayAtom.addRowBefore(atom.treeBranch[0]);
        pos = model.offsetOf(arrayAtom.getCell(atom.treeBranch[0] - 1, 0)![0]);
        break;

      case 'before column':
        if (arrayAtom.maxColumns <= arrayAtom.colCount) {
          model.announce('plonk');
          return;
        }
        arrayAtom.addColumnBefore(atom.treeBranch[1]);
        pos = model.offsetOf(
          arrayAtom.getCell(atom.treeBranch[0], atom.treeBranch[1] - 1)![0]
        );
        break;
    }
    model.setSelection(pos, pos + 1);
  }
}

export function addRowAfter(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'insertText' })) return false;
  addCell(model, 'after row');
  contentDidChange(model, { inputType: 'insertText' });
  return true;
}

export function addRowBefore(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'insertText' })) return false;
  addCell(model, 'before row');
  contentDidChange(model, { inputType: 'insertText' });
  return true;
}

export function addColumnAfter(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'insertText' })) return false;
  addCell(model, 'after column');
  contentDidChange(model, { inputType: 'insertText' });
  return true;
}

export function addColumnBefore(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'insertText' })) return false;
  addCell(model, 'before column');
  contentDidChange(model, { inputType: 'insertText' });
  return true;
}

/**
 * Internal primitive to remove a column/row in a matrix
 */
function removeCell(model: ModelPrivate, where: 'row' | 'column'): void {
  // This command is only applicable if we're in an ArrayAtom
  let atom = model.at(model.position);

  while (
    atom &&
    !(Array.isArray(atom.treeBranch) && atom.parent instanceof ArrayAtom)
  )
    atom = atom.parent!;

  if (Array.isArray(atom?.treeBranch) && atom?.parent instanceof ArrayAtom) {
    const arrayAtom = atom.parent;
    const treeBranch = atom.treeBranch;
    let pos: number | undefined;
    switch (where) {
      case 'row':
        if (arrayAtom.rowCount > 1) {
          arrayAtom.removeRow(treeBranch[0]);
          const cell = arrayAtom.getCell(
            Math.max(0, treeBranch[0] - 1),
            treeBranch[1]
          )!;
          pos = model.offsetOf(cell[cell.length - 1]);
        }
        break;

      case 'column':
        if (arrayAtom.colCount > arrayAtom.minColumns) {
          arrayAtom.removeColumn(treeBranch[1]);
          const cell = arrayAtom.getCell(
            treeBranch[0],
            Math.max(0, treeBranch[1] - 1)
          )!;
          pos = model.offsetOf(cell[cell.length - 1]);
        }
        break;
    }
    if (pos) model.setPositionHandlingPlaceholder(pos);
  }
}

export function removeRow(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'deleteContent' })) return false;
  removeCell(model, 'row');
  contentDidChange(model, { inputType: 'deleteContent' });
  return true;
}

export function removeColumn(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'deleteContent' })) return false;
  removeCell(model, 'column');
  contentDidChange(model, { inputType: 'deleteContent' });
  return true;
}

export function createAlignedEnvironment(model: ModelPrivate): boolean {
  if (!contentWillChange(model, { inputType: 'insertLineBreak' })) return false;
  // do custom stuff with enter
  let atom = model.at(model.position);

  console.log(model);

  while (
    atom &&
    atom.parent &&
    !(Array.isArray(atom.treeBranch) && atom.parent instanceof ArrayAtom)
  )
    atom = atom.parent!;

  if (Array.isArray(atom?.treeBranch) && atom.parent instanceof ArrayAtom) {
    // add row if cursor is at end of row at bottom of array
    const arrayAtom = atom.parent;
    // ensure we are dealing with aligned environment
    if (arrayAtom.colSeparationType === 'align') {
      // treeBranch[1] (column) is the second column in the aligned environment
      if (
        atom.treeBranch[1] === 1 &&
        atom.treeBranch[0] === arrayAtom.rowCount - 1
      ) {
        arrayAtom.addRowAfter(atom.treeBranch[0]);
        const pos = model.offsetOf(
          arrayAtom.getCell(atom.treeBranch[0] + 1, 0)![0]
        );
        model.setSelection(pos, pos + 1);
      } else {
        // move cursor down one row
        const belowCell = arrayAtom.getCell(
          atom.treeBranch[0] + 1,
          atom.treeBranch[1]
        );
        if (belowCell) {
          const pos = model.offsetOf(belowCell[belowCell.length - 1]);
          model.setSelection(pos, pos + 1);
        }
      }
    }
  } else {
    // todo: toggle an easy mode? need to make navigation and adding equals etc custom while in this mode
    // re-flow line into an ArrayAtom aligned environment
    let latex = model.mathfield.getValue();
    // split latex into left and right based on aligned delimiter
    if (splitRegex.test(latex)) {
      latex = latex.replace(splitRegex, '$1&$2$3');
    }
    const alignedLatex = `\\begin{aligned}${latex} \\\\ \\placeholder{} & \\placeholder{} \\end{aligned}`;
    model.mathfield.setValue(alignedLatex);
    // cursor is coincidentally placed in the correct place
  }

  // end custom stuff
  contentDidChange(model, { inputType: 'insertLineBreak' });
  return true;
}

export const alignedDelimiters = [
  '=',
  '\\gt',
  '\\lt',
  '\\geq',
  '\\leq',
  '\\geqslant',
  '\\leqslant',
];

const splitRegex = new RegExp(`^(.+?)(${alignedDelimiters.join('|')})(.+)$`);

registerCommand(
  {
    addRowAfter,
    addColumnAfter,
    addRowBefore,
    addColumnBefore,
    removeRow,
    removeColumn,
    createAlignedEnvironment,
  },
  { target: 'model', category: 'array-edit' }
);
