import { describe, expect, it } from 'vitest';
import { ProfileBook, ProfileBookError } from '../../src/domain/profile-book';
import { aProfile } from './builders';

const slayer = aProfile({ id: 'a', name: 'SlayeR' });
const other = aProfile({ id: 'b', name: 'Other' });

describe('ProfileBook', () => {
  it('starts empty with nothing active', () => {
    expect(ProfileBook.empty().profiles()).toEqual([]);
    expect(ProfileBook.empty().active()).toBeUndefined();
  });

  it('makes a newly added profile active', () => {
    const book = ProfileBook.empty().add(slayer).add(other);

    expect(book.profiles()).toEqual([slayer, other]);
    expect(book.active()).toBe(other);
  });

  it('refuses a second profile with the same name, ignoring case', () => {
    const book = ProfileBook.empty().add(slayer);

    expect(() => book.add(aProfile({ id: 'c', name: 'slayer' }))).toThrow(
      new ProfileBookError('There\'s already a profile called "SlayeR".'),
    );
    expect(book.profiles()).toEqual([slayer]);
  });

  it('lets a profile keep its own name when updated', () => {
    const book = ProfileBook.empty().add(slayer);
    const renamedCase = slayer.withDetails({ ...slayer.details(), name: 'SLAYER' });

    expect(book.update(renamedCase).profiles()[0]?.name).toBe('SLAYER');
  });

  it("refuses to rename a profile to another profile's name", () => {
    const book = ProfileBook.empty().add(slayer).add(other);

    expect(() => book.update(other.withDetails({ ...other.details(), name: 'SlayeR' }))).toThrow(
      ProfileBookError,
    );
  });

  it('refuses to update or remove a profile it does not have', () => {
    const book = ProfileBook.empty().add(slayer);

    expect(() => book.update(other)).toThrow(new ProfileBookError('No profile with id b.'));
    expect(() => book.remove('b')).toThrow(ProfileBookError);
  });

  it('activates the first remaining profile when the active one is removed', () => {
    const book = ProfileBook.empty().add(slayer).add(other).remove('b');

    expect(book.active()).toBe(slayer);
  });

  it('keeps the active profile when another is removed', () => {
    const book = ProfileBook.empty().add(slayer).add(other).activate('a').remove('b');

    expect(book.active()).toBe(slayer);
  });

  it('has nothing active after removing the last profile', () => {
    expect(ProfileBook.empty().add(slayer).remove('a').active()).toBeUndefined();
  });

  it('switches the active profile', () => {
    const book = ProfileBook.empty().add(slayer).add(other).activate('a');

    expect(book.active()).toBe(slayer);
  });

  it('restores a saved book, falling back to the first profile for an unknown active id', () => {
    expect(ProfileBook.restore([slayer, other], 'b').active()).toBe(other);
    expect(ProfileBook.restore([slayer, other], 'gone').active()).toBe(slayer);
  });
});
