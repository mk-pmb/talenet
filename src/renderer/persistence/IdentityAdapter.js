import Promise from 'bluebird'
import pull from 'pull-stream'

import SSBAdapter from './SSBAdapter'
import Identity from '../models/Identity'
import SkillAdapter from './SkillAdapter'

/**
 * Persistence adapter for loading and publishing identity related data.
 */
export default class IdentityAdapter {
  static IDENTITY_TYPE_PREFIX = SSBAdapter.TALENET_TYPE_PREFIX + 'identity-'
  static TYPE_IDENTITY_SET_NAME = 'about' // predefined by ssb, thus no prefix
  static TYPE_IDENTITY_SET_IMAGE = IdentityAdapter.TYPE_IDENTITY_SET_NAME // predefined by ssb, thus no prefix
  static TYPE_IDENTITY_SKILL_ASSIGNMENT = IdentityAdapter.IDENTITY_TYPE_PREFIX + 'skill_assignment'

  _ownIdentityKeySubscriptions = []
  _identitySubscriptions = {}

  _identityByKey = {}

  constructor ({ ssbAdapter }) {
    this._ssbAdapter = ssbAdapter

    ssbAdapter.registerMessageHandlers({
      [IdentityAdapter.TYPE_IDENTITY_SKILL_ASSIGNMENT]: this._handleIdentitySkillAssignment.bind(this)
    })
  }

  connect () {
    return new Promise((resolve, reject) => {
      this._pullIdentities()
      resolve()
    })
  }

  _getIdentity (key) {
    return this._identityByKey[key] || new Identity({ key })
  }

  _setIdentity (identity) {
    this._identityByKey[identity.key()] = identity
  }

  _pullIdentities () {
    pull(
      this._ssbAdapter.streamAbouts(),
      pull.drain(about => {
        const key = about.author
        const currentIdentity = this._getIdentity(key)
        const updatedIdentity = currentIdentity.withSsbAbout(about.about)
        this._setIdentity(updatedIdentity)

        this._propagateIdentityUpdate(updatedIdentity)
      })
    )
  }

  subscribeOwnIdentityKey (onUpdate) {
    const subscription = this._ssbAdapter.subscribe(this._ownIdentityKeySubscriptions, null, onUpdate)

    // cheating for now as we currently do not support switching identities
    onUpdate(this.ownIdentityKey())

    return subscription
  }

  subscribeIdentities (onUpdate, identityKeys) {
    const subscription = this._ssbAdapter.subscribe(this._identitySubscriptions, identityKeys, onUpdate)

    for (const key of identityKeys) {
      this._propagateIdentityUpdate(this._getIdentity(key))
    }
    this._loadIdentitySkillAssociations(identityKeys)
    return subscription
  }

  _propagateIdentityUpdate (identity) {
    SSBAdapter.propagateUpdate(
      this._identitySubscriptions[identity.key()],
      identity
    )
  }

  _loadIdentitySkillAssociations (identityKeys) {
    return new Promise((resolve, reject) => {
      pull(
        this._ssbAdapter.streamByType(SkillAdapter.TYPE_IDENTITY_SKILL_ASSIGNMENT),
        pull.drain(msg => {
          if (identityKeys.includes(msg.value.author)) {
            this._handleIdentitySkillAssignment(msg)
          }
        }, () => {
          // TODO: Load skills?
          resolve()
        })
      )
    })
  }

  _updateIdentitySkillAssignment (skillKey, action) {
    return this._ssbAdapter.publish(IdentityAdapter.TYPE_IDENTITY_SKILL_ASSIGNMENT, {
      skillKey,
      action
    }).then(() => {
      return skillKey
    })
  }

  setIdentityName (identityKey, name) {
    return this._ssbAdapter.publish(IdentityAdapter.TYPE_IDENTITY_SET_NAME, {
      about: identityKey,
      name: name
    }).then(() => identityKey)
  }

  setIdentityImage (identityKey, imageFile) {
    return this._ssbAdapter.storeFile(imageFile)
      .then((imageKey) => {
        return this._ssbAdapter.publish(IdentityAdapter.TYPE_IDENTITY_SET_IMAGE, {
          about: identityKey,
          image: {
            link: imageKey,
            size: imageFile.size,
            type: imageFile.type
          }
        }).then(() => identityKey)
      })
  }

  assignSkillToIdentity (skillKey) {
    return this._updateIdentitySkillAssignment(skillKey, Identity.SSB_ACTION_ASSIGN_SKILL)
  }

  unassignSkillFromIdentity (skillKey) {
    return this._updateIdentitySkillAssignment(skillKey, Identity.SSB_ACTION_UNASSIGN_SKILL)
  }

  _handleIdentitySkillAssignment (msg) {
    const identityKey = msg.value.author

    const currentIdentity = this._getIdentity(identityKey)
    const updatedIdentity = currentIdentity.withSsbSkillAssignment(msg)

    this._setIdentity(updatedIdentity)

    this._propagateIdentityUpdate(updatedIdentity)
  }

  ownIdentityKey () {
    return this._ssbAdapter.ownId()
  }
}