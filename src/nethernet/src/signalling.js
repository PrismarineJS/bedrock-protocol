const SignalType = {
  ConnectRequest: 'CONNECTREQUEST',
  ConnectResponse: 'CONNECTRESPONSE',
  CandidateAdd: 'CANDIDATEADD',
  ConnectError: 'CONNECTERROR'
}

class SignalStructure {
  constructor (type, connectionId, data, networkId, serverNetworkId) {
    this.type = type
    this.connectionId = connectionId
    this.data = data
    this.networkId = networkId
    this.serverNetworkId = serverNetworkId
  }

  toString () {
    return `${this.type} ${this.connectionId} ${this.data}`
  }

  static fromString (message) {
    const [type, connectionId, ...data] = message.split(' ')

    return new this(type, connectionId, data.join(' '))
  }
}

module.exports = { SignalStructure, SignalType }