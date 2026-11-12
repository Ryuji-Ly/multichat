import type { StreamerProfile } from './streamer-profile';

export class ProfileBookError extends Error {
  override name = 'ProfileBookError';
}

/**
 * All saved streamer profiles and which one is on screen. The only way to add, change or remove a
 * profile, so names stay unique and the active profile always exists. Every change returns a new book
 * and leaves this one untouched.
 */
export class ProfileBook {
  private constructor(
    private readonly entries: readonly StreamerProfile[],
    private readonly activeId: string | undefined,
  ) {}

  static empty(): ProfileBook {
    return new ProfileBook([], undefined);
  }

  /** Rebuilds a saved book; an unknown active id falls back to the first profile. */
  static restore(profiles: readonly StreamerProfile[], activeId: string | undefined): ProfileBook {
    const book = profiles.reduce((acc, profile) => acc.add(profile), ProfileBook.empty());
    const known = profiles.some((profile) => profile.id === activeId);
    return new ProfileBook(book.entries, known ? activeId : profiles[0]?.id);
  }

  profiles(): readonly StreamerProfile[] {
    return this.entries;
  }

  active(): StreamerProfile | undefined {
    return this.entries.find((profile) => profile.id === this.activeId);
  }

  /** Adds a profile and makes it the active one. */
  add(profile: StreamerProfile): ProfileBook {
    if (this.entries.some((existing) => existing.id === profile.id)) {
      throw new ProfileBookError(`A profile with id ${profile.id} already exists.`);
    }
    this.ensureNameIsFree(profile);
    return new ProfileBook([...this.entries, profile], profile.id);
  }

  update(profile: StreamerProfile): ProfileBook {
    this.ensureExists(profile.id);
    this.ensureNameIsFree(profile);
    return new ProfileBook(
      this.entries.map((existing) => (existing.id === profile.id ? profile : existing)),
      this.activeId,
    );
  }

  /** Removes a profile; if it was active, the first remaining profile becomes active. */
  remove(id: string): ProfileBook {
    this.ensureExists(id);
    const remaining = this.entries.filter((profile) => profile.id !== id);
    const activeId = id === this.activeId ? remaining[0]?.id : this.activeId;
    return new ProfileBook(remaining, activeId);
  }

  activate(id: string): ProfileBook {
    this.ensureExists(id);
    return new ProfileBook(this.entries, id);
  }

  private ensureExists(id: string): void {
    if (!this.entries.some((profile) => profile.id === id)) {
      throw new ProfileBookError(`No profile with id ${id}.`);
    }
  }

  private ensureNameIsFree(profile: StreamerProfile): void {
    const clash = this.entries.find((other) => other.id !== profile.id && other.hasName(profile.name));
    if (clash) throw new ProfileBookError(`There's already a profile called "${clash.name}".`);
  }
}
