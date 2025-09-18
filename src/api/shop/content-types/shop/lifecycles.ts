/**
 * Shop lifecycle hooks
 * Automatically handle user assignment without custom controllers
 */

export default {
  // Before updating, prevent changing the user
  async beforeUpdate(event) {
    const { data } = event.params;
    
    // Prevent changing the user
    if (data.users_permissions_user) {
      delete data.users_permissions_user;
    }
  }
};
