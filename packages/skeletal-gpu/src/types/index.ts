export interface Bone {
  /** Human-readable bone name (need not be unique; addressing is positional). */
  name: string
  /**
   * Parent bone index, or `-1` for the root. Must be an earlier index so
   * one forward pass composes the hierarchy.
   */
  parent: number
}

export interface AnimationTrack {
  /** Track name addressed by `setBlend`. Must be unique per skeleton. */
  name: string
  /** Loop duration in seconds; instance time wraps around it. Positive. */
  durationSeconds: number
  /**
   * Per-frame bone transforms, tightly packed frame-major: each frame holds
   * `bones.length * 7` floats of `[qx, qy, qz, qw, tx, ty, tz]` per bone.
   * Length must be a whole number of frames (`>= 1`).
   */
  keyframes: Float32Array
}

export interface SkeletalGpuOptions {
  /** Backend to run the skinning compute pass on. */
  backend: 'webgpu' | 'webgl2'
  /** Instance pool size; positive integer. */
  maxInstances: number
}

/** Internal validated track: frame count plus a defensive data copy. */
export interface TrackRecord {
  /** Loop duration in seconds. */
  durationSeconds: number
  /** Whole frames in `data`. */
  frames: number
  /** Copied keyframe table (`frames * bones * 7` floats). */
  data: Float32Array
}

/** Internal validated skeleton with copied bones and indexed tracks. */
export interface SkeletonRecord {
  /** Bones in registration (parent-first) order. */
  bones: Array<Bone>
  /** Tracks by name. */
  tracks: Map<string, TrackRecord>
}

/** Internal pooled animation instance. */
export interface InstanceRecord {
  /** Whether the slot is allocated. */
  active: boolean
  /** Owning skeleton id, or `-1` when free. */
  skeletonId: number
  /** Blend-tree weights by track name (`(0, 1]`). */
  weights: Map<string, number>
  /** Accumulated animation time in seconds. */
  time: number
  /** Live world matrices (`bones * 16` column-major floats). */
  matrices: Float32Array
}
