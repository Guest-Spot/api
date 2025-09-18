/**
 * Trip lifecycle hooks
 * Automatically handle owner assignment without custom controllers
 */

export default {
  // Before creating a trip, automatically set the owner
  async beforeCreate(event) {
    const { data } = event.params;
    const { user } = event.state || {};

    if (user && user.documentId) {
      // Automatically set the owner to the current user
      data.ownerDocumentId = user.documentId;
    }
  },

  // Before updating, prevent changing the owner (except from admin panel)
  async beforeUpdate(event) {
    const { data } = event.params;
    
    // Only prevent changing the owner if request is NOT from admin panel
    if (data.ownerDocumentId) {
      delete data.ownerDocumentId;
    }
  }
};
