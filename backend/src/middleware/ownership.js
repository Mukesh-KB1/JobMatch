// Generic wrapper for GET/PUT/DELETE /:id routes on user-owned resources.
//
// It takes a repository "findByIdForUser(id, userId)" loader - one that has
// userId baked into the Mongo query filter itself (see repositories/*) - and
// returns a plain 404 on any mismatch: wrong owner, non-existent id, or
// malformed id are all indistinguishable from the caller's point of view.
// The API must never confirm that a foreign resource exists, so this never
// returns 403.
//
// Usage:
//   router.get('/:id', requireAuth, loadOwned(resumeRepository.findByIdForUser, 'resume'), handler)
//   // handler reads req.resume
export function loadOwned(findByIdForUser, resourceKey) {
  return async function ownershipMiddleware(req, res, next) {
    try {
      const doc = await findByIdForUser(req.params.id, req.user.id);
      if (!doc) {
        return res.status(404).json({ error: 'Not found.' });
      }
      req[resourceKey] = doc;
      next();
    } catch (err) {
      next(err);
    }
  };
}
