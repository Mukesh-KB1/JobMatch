// Generic wrapper for GET/PUT/DELETE /:id routes on user-owned resources.
//
// It takes a repository "findByIdForUser(id, userId)" loader - one that has
// userId baked into the Mongo query filter itself (see repositories/*) - and
// returns a plain 404 on any mismatch: wrong owner, non-existent id, or
// malformed id are all indistinguishable from the caller's point of view.
// The API must never confirm that a foreign resource exists, so this never
// returns 403.
//
// IMPORTANT: never pass a resourceKey of 'resume' (or any other name that
// collides with a property/method Node's IncomingMessage/Readable stream
// already defines - resume, pipe, read, destroy, etc). req is that stream
// object, and overwriting req.resume with a plain object silently breaks
// Node's own internal req.resume() call used to drain the request after
// the response finishes. That throws *outside* Express's request cycle, so
// it isn't caught by any error handler - it crashes the entire process,
// taking down every other in-flight request with it. Use a suffixed key
// instead, e.g. 'resumeDoc'.
//
// Usage:
//   router.get('/:id', requireAuth, loadOwned(resumeRepository.findByIdForUser, 'resumeDoc'), handler)
//   // handler reads req.resumeDoc
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