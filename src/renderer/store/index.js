import Vue from 'vue'
import Vuex from 'vuex'

import i18n from '../i18n'
import page from './page'

// Make vue.js use the vuex.js plugin. This also enables the possibility to inject the
// store into the components.
Vue.use(Vuex)

export default new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production', // prevent state changes outside of mutations

  modules: {
    page: page({ i18n, document })
  },

  state: {
    loggedIn: false // simple example during setup phase ;-)
  },
  getters: {
    loggedOut: state => !state.loggedIn
  },
  mutations: {
    login: state => {
      state.loggedIn = true
    }
  }
})