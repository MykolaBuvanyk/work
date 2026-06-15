import test from "node:test";
import assert from "node:assert/strict";
import {
  getToolbarCanvasChangeTypes,
  normalizeToolbarCanvasChangeTypes,
} from "./toolbarHistoryChanges.js";

const baseState = {
  currentShapeType: "rectangle",
  sizeValues: {
    width: 120,
    height: 80,
    cornerRadius: 2,
  },
  globalColors: {
    textColor: "#000000",
    backgroundColor: "#ffffff",
    backgroundType: "solid",
  },
  selectedColorIndex: 0,
  isAdhesiveTape: true,
  activeHolesType: "none",
  holesDiameter: 2.5,
};

test("returns no canvas history changes for unrelated toolbar fields", () => {
  assert.deepEqual(
    getToolbarCanvasChangeTypes(baseState, {
      ...baseState,
      activeHolesType: "one",
      holesDiameter: 3,
    }),
    [],
  );
});

test("detects only the canvas size field when size values change", () => {
  assert.deepEqual(
    getToolbarCanvasChangeTypes(baseState, {
      ...baseState,
      sizeValues: {
        ...baseState.sizeValues,
        width: 130,
      },
    }),
    ["size"],
  );
});

test("detects only the canvas colors field when colors change", () => {
  assert.deepEqual(
    getToolbarCanvasChangeTypes(baseState, {
      ...baseState,
      globalColors: {
        ...baseState.globalColors,
        backgroundColor: "#000000",
      },
      selectedColorIndex: 3,
    }),
    ["colors"],
  );
});

test("detects only the canvas shape field when shape changes", () => {
  assert.deepEqual(
    getToolbarCanvasChangeTypes(baseState, {
      ...baseState,
      currentShapeType: "circle",
    }),
    ["shape"],
  );
});

test("normalizes explicit change type payloads", () => {
  assert.deepEqual(
    normalizeToolbarCanvasChangeTypes(["shape", "colors", "shape", "holes", "size"]),
    ["size", "colors", "shape"],
  );
});
