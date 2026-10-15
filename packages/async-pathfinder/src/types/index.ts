/** Integer grid cell coordinates. */
export interface Vec2 {
  /** Column in `0 <= x < width`. */
  x: number
  /** Row in `0 <= y < height`. */
  y: number
}

export interface PathRequest {
  /** Start cell; must be in bounds and passable. */
  start: Vec2
  /** Goal cell; must be in bounds and passable. */
  goal: Vec2
  /** Grid width in cells; positive integer. */
  width: number
  /** Grid height in cells; positive integer. */
  height: number
  /**
   * Returns whether the cell at (x, y) can be walked through. Called for
   * in-bounds cells only — keep it cheap, it runs per expansion.
   */
  passable: (x: number, y: number) => boolean
}

export interface PathfinderOptions {
  /**
   * Maximum number of A* node expansions before yielding back to the event
   * loop. Positive integer, defaults to `512`. Lower values keep frames
   * smoother at the cost of more frames per search.
   */
  maxExpansionsPerSlice?: number
  /**
   * Heuristic weighting (`1` = classic A*, `> 1` = greedier/faster but less
   * optimal). Must be a positive number, defaults to `1`.
   */
  heuristicWeight?: number
  /** Use Theta* parent-skipping plus string-pulling for any-angle paths. Defaults to `false`. */
  thetaStar?: boolean
  /** Apply one Chaikin corner-cutting pass over the final waypoint list. Defaults to `false`. */
  smoothPath?: boolean
}

/** Grid predicate answering whether a cell can be entered. */
export type Passable = (x: number, y: number) => boolean
