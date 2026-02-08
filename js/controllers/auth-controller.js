(function initAuthController(global) {
    global.DSAuthController = {
        handleGoogleSignIn: global.handleGoogleSignIn,
        handleEmailSignIn: global.handleEmailSignIn,
        showSignUpForm: global.showSignUpForm,
        handleSignUp: global.handleSignUp,
        handlePasswordReset: global.handlePasswordReset,
        handleSignOut: global.handleSignOut,
    };
})(window);
