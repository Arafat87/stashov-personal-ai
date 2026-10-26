const test = require('node:test');
const assert = require('node:assert/strict');

const { canonicalBookmarkUrl, findLibraryDuplicates, librarySectionsWithCounts } = require('../lib/library');

function reference(id, url, extra = {}) {
  return {
    id,
    url,
    title: extra.title || `Reference ${id}`,
    domain: extra.domain || 'example.com',
    category: extra.category || 'Programming, Cloud & Dev Tools',
    ...extra,
  };
}

test('canonical URLs ignore tracking noise, www, trailing slashes, and case', () => {
  assert.equal(
    canonicalBookmarkUrl('https://www.Example.com/Docs/?utm_source=newsletter&b=2&a=1#install'),
    canonicalBookmarkUrl('http://example.com/Docs?a=1&b=2')
  );
  assert.notEqual(
    canonicalBookmarkUrl('https://example.com/docs?version=18'),
    canonicalBookmarkUrl('https://example.com/docs?version=20')
  );
  assert.equal(canonicalBookmarkUrl('not a url/'), 'not a url');
});

test('duplicate review groups live library links and ignores archived or product entries', () => {
  const bookmarks = [
    reference('a', 'https://www.example.com/docs/?utm_campaign=spring'),
    reference('b', 'https://example.com/docs'),
    reference('c', 'https://example.com/docs', { library_archived: true }),
    reference('d', 'https://shop.example.com/parka', {
      category: 'Menswear & Streetwear',
      title: "Men's Heavy Parka Coat",
    }),
    reference('e', 'https://unique.example.com/guide'),
  ];
  const groups = findLibraryDuplicates(bookmarks);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].extra, 1);
  assert.deepEqual(groups[0].items.map((item) => item.id), ['a', 'b']);
});

test('archived entries stop counting toward library sections', () => {
  const bookmarks = [
    reference('a', 'https://example.com/one'),
    reference('b', 'https://example.com/two', { library_archived: true }),
  ];
  const sections = librarySectionsWithCounts(bookmarks);
  const programming = sections.find((section) => section.id === 'programming');
  assert.equal(programming.count, 1);
});
