"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageID = exports.PacketReliability = exports.PacketPriority = void 0;
/// These enumerations are used to describe when packets are delivered.
var PacketPriority;
(function (PacketPriority) {
    /// The highest possible priority. These message trigger sends immediately, and are generally not buffered or aggregated into a single datagram.
    PacketPriority[PacketPriority["IMMEDIATE_PRIORITY"] = 0] = "IMMEDIATE_PRIORITY";
    /// For every 2 IMMEDIATE_PRIORITY messages, 1 HIGH_PRIORITY will be sent.
    /// Messages at this priority and lower are buffered to be sent in groups at 10 millisecond intervals to reduce UDP overhead and better measure congestion control. 
    PacketPriority[PacketPriority["HIGH_PRIORITY"] = 1] = "HIGH_PRIORITY";
    /// For every 2 HIGH_PRIORITY messages, 1 MEDIUM_PRIORITY will be sent.
    /// Messages at this priority and lower are buffered to be sent in groups at 10 millisecond intervals to reduce UDP overhead and better measure congestion control. 
    PacketPriority[PacketPriority["MEDIUM_PRIORITY"] = 2] = "MEDIUM_PRIORITY";
    /// For every 2 MEDIUM_PRIORITY messages, 1 LOW_PRIORITY will be sent.
    /// Messages at this priority and lower are buffered to be sent in groups at 10 millisecond intervals to reduce UDP overhead and better measure congestion control. 
    PacketPriority[PacketPriority["LOW_PRIORITY"] = 3] = "LOW_PRIORITY";
    /// \internal
    PacketPriority[PacketPriority["NUMBER_OF_PRIORITIES"] = 4] = "NUMBER_OF_PRIORITIES";
})(PacketPriority = exports.PacketPriority || (exports.PacketPriority = {}));
;
/// These enumerations are used to describe how packets are delivered.
/// \note  Note to self: I write this with 3 bits in the stream.  If I add more remember to change that
/// \note In ReliabilityLayer::WriteToBitStreamFromInternalPacket I assume there are 5 major types
/// \note Do not reorder, I check on >= UNRELIABLE_WITH_ACK_RECEIPT
var PacketReliability;
(function (PacketReliability) {
    /// Same as regular UDP, except that it will also discard duplicate datagrams.  RakNet adds (6 to 17) + 21 bits of overhead, 16 of which is used to detect duplicate packets and 6 to 17 of which is used for message length.
    PacketReliability[PacketReliability["UNRELIABLE"] = 0] = "UNRELIABLE";
    /// Regular UDP with a sequence counter.  Out of order messages will be discarded.
    /// Sequenced and ordered messages sent on the same channel will arrive in the order sent.
    PacketReliability[PacketReliability["UNRELIABLE_SEQUENCED"] = 1] = "UNRELIABLE_SEQUENCED";
    /// The message is sent reliably, but not necessarily in any order.  Same overhead as UNRELIABLE.
    PacketReliability[PacketReliability["RELIABLE"] = 2] = "RELIABLE";
    /// This message is reliable and will arrive in the order you sent it.  Messages will be delayed while waiting for out of order messages.  Same overhead as UNRELIABLE_SEQUENCED.
    /// Sequenced and ordered messages sent on the same channel will arrive in the order sent.
    PacketReliability[PacketReliability["RELIABLE_ORDERED"] = 3] = "RELIABLE_ORDERED";
    /// This message is reliable and will arrive in the sequence you sent it.  Out or order messages will be dropped.  Same overhead as UNRELIABLE_SEQUENCED.
    /// Sequenced and ordered messages sent on the same channel will arrive in the order sent.
    PacketReliability[PacketReliability["RELIABLE_SEQUENCED"] = 4] = "RELIABLE_SEQUENCED";
    /// Same as UNRELIABLE, however the user will get either ID_SND_RECEIPT_ACKED or ID_SND_RECEIPT_LOSS based on the result of sending this message when calling RakPeerInterface::Receive(). Bytes 1-4 will contain the number returned from the Send() function. On disconnect or shutdown, all messages not previously acked should be considered lost.
    PacketReliability[PacketReliability["UNRELIABLE_WITH_ACK_RECEIPT"] = 5] = "UNRELIABLE_WITH_ACK_RECEIPT";
    /// Same as UNRELIABLE_SEQUENCED, however the user will get either ID_SND_RECEIPT_ACKED or ID_SND_RECEIPT_LOSS based on the result of sending this message when calling RakPeerInterface::Receive(). Bytes 1-4 will contain the number returned from the Send() function. On disconnect or shutdown, all messages not previously acked should be considered lost.
    /// 05/04/10 You can't have sequenced and ack receipts, because you don't know if the other system discarded the message, meaning you don't know if the message was processed
    // UNRELIABLE_SEQUENCED_WITH_ACK_RECEIPT,
    /// Same as RELIABLE. The user will also get ID_SND_RECEIPT_ACKED after the message is delivered when calling RakPeerInterface::Receive(). ID_SND_RECEIPT_ACKED is returned when the message arrives, not necessarily the order when it was sent. Bytes 1-4 will contain the number returned from the Send() function. On disconnect or shutdown, all messages not previously acked should be considered lost. This does not return ID_SND_RECEIPT_LOSS.
    PacketReliability[PacketReliability["RELIABLE_WITH_ACK_RECEIPT"] = 6] = "RELIABLE_WITH_ACK_RECEIPT";
    /// Same as RELIABLE_ORDERED_ACK_RECEIPT. The user will also get ID_SND_RECEIPT_ACKED after the message is delivered when calling RakPeerInterface::Receive(). ID_SND_RECEIPT_ACKED is returned when the message arrives, not necessarily the order when it was sent. Bytes 1-4 will contain the number returned from the Send() function. On disconnect or shutdown, all messages not previously acked should be considered lost. This does not return ID_SND_RECEIPT_LOSS.
    PacketReliability[PacketReliability["RELIABLE_ORDERED_WITH_ACK_RECEIPT"] = 7] = "RELIABLE_ORDERED_WITH_ACK_RECEIPT";
    /// Same as RELIABLE_SEQUENCED. The user will also get ID_SND_RECEIPT_ACKED after the message is delivered when calling RakPeerInterface::Receive(). Bytes 1-4 will contain the number returned from the Send() function. On disconnect or shutdown, all messages not previously acked should be considered lost.
    /// 05/04/10 You can't have sequenced and ack receipts, because you don't know if the other system discarded the message, meaning you don't know if the message was processed
    // RELIABLE_SEQUENCED_WITH_ACK_RECEIPT,
    /// \internal
    PacketReliability[PacketReliability["NUMBER_OF_RELIABILITIES"] = 8] = "NUMBER_OF_RELIABILITIES";
})(PacketReliability = exports.PacketReliability || (exports.PacketReliability = {}));
;
var MessageID;
(function (MessageID) {
    //
    // RESERVED TYPES - DO NOT CHANGE THESE
    // All types from RakPeer
    //
    /// These types are never returned to the user.
    /// Ping from a connected system.  Update timestamps (internal use only)
    MessageID[MessageID["ID_CONNECTED_PING"] = 0] = "ID_CONNECTED_PING";
    /// Ping from an unconnected system.  Reply but do not update timestamps. (internal use only)
    MessageID[MessageID["ID_UNCONNECTED_PING"] = 1] = "ID_UNCONNECTED_PING";
    /// Ping from an unconnected system.  Only reply if we have open connections. Do not update timestamps. (internal use only)
    MessageID[MessageID["ID_UNCONNECTED_PING_OPEN_CONNECTIONS"] = 2] = "ID_UNCONNECTED_PING_OPEN_CONNECTIONS";
    /// Pong from a connected system.  Update timestamps (internal use only)
    MessageID[MessageID["ID_CONNECTED_PONG"] = 3] = "ID_CONNECTED_PONG";
    /// A reliable packet to detect lost connections (internal use only)
    MessageID[MessageID["ID_DETECT_LOST_CONNECTIONS"] = 4] = "ID_DETECT_LOST_CONNECTIONS";
    /// C2S: Initial query: Header(1), OfflineMesageID(16), Protocol number(1), Pad(toMTU), sent with no fragment set.
    /// If protocol fails on server, returns ID_INCOMPATIBLE_PROTOCOL_VERSION to client
    MessageID[MessageID["ID_OPEN_CONNECTION_REQUEST_1"] = 5] = "ID_OPEN_CONNECTION_REQUEST_1";
    /// S2C: Header(1), OfflineMesageID(16), server GUID(8), HasSecurity(1), Cookie(4, if HasSecurity)
    /// , public key (if do security is true), MTU(2). If public key fails on client, returns ID_PUBLIC_KEY_MISMATCH
    MessageID[MessageID["ID_OPEN_CONNECTION_REPLY_1"] = 6] = "ID_OPEN_CONNECTION_REPLY_1";
    /// C2S: Header(1), OfflineMesageID(16), Cookie(4, if HasSecurity is true on the server), clientSupportsSecurity(1 bit),
    /// handshakeChallenge (if has security on both server and client), remoteBindingAddress(6), MTU(2), client GUID(8)
    /// Connection slot allocated if cookie is valid, server is not full, GUID and IP not already in use.
    MessageID[MessageID["ID_OPEN_CONNECTION_REQUEST_2"] = 7] = "ID_OPEN_CONNECTION_REQUEST_2";
    /// S2C: Header(1), OfflineMesageID(16), server GUID(8), mtu(2), doSecurity(1 bit), handshakeAnswer (if do security is true)
    MessageID[MessageID["ID_OPEN_CONNECTION_REPLY_2"] = 8] = "ID_OPEN_CONNECTION_REPLY_2";
    /// C2S: Header(1), GUID(8), Timestamp, HasSecurity(1), Proof(32)
    MessageID[MessageID["ID_CONNECTION_REQUEST"] = 9] = "ID_CONNECTION_REQUEST";
    /// RakPeer - Remote system requires secure connections, pass a public key to RakPeerInterface::Connect()
    MessageID[MessageID["ID_REMOTE_SYSTEM_REQUIRES_PUBLIC_KEY"] = 10] = "ID_REMOTE_SYSTEM_REQUIRES_PUBLIC_KEY";
    /// RakPeer - We passed a public key to RakPeerInterface::Connect(), but the other system did not have security turned on
    MessageID[MessageID["ID_OUR_SYSTEM_REQUIRES_SECURITY"] = 11] = "ID_OUR_SYSTEM_REQUIRES_SECURITY";
    /// RakPeer - Wrong public key passed to RakPeerInterface::Connect()
    MessageID[MessageID["ID_PUBLIC_KEY_MISMATCH"] = 12] = "ID_PUBLIC_KEY_MISMATCH";
    /// RakPeer - Same as ID_ADVERTISE_SYSTEM, but intended for internal use rather than being passed to the user.
    /// Second byte indicates type. Used currently for NAT punchthrough for receiver port advertisement. See ID_NAT_ADVERTISE_RECIPIENT_PORT
    MessageID[MessageID["ID_OUT_OF_BAND_INTERNAL"] = 13] = "ID_OUT_OF_BAND_INTERNAL";
    /// If RakPeerInterface::Send() is called where PacketReliability contains _WITH_ACK_RECEIPT, then on a later call to
    /// RakPeerInterface::Receive() you will get ID_SND_RECEIPT_ACKED or ID_SND_RECEIPT_LOSS. The message will be 5 bytes long,
    /// and bytes 1-4 inclusive will contain a number in native order containing a number that identifies this message.
    /// This number will be returned by RakPeerInterface::Send() or RakPeerInterface::SendList(). ID_SND_RECEIPT_ACKED means that
    /// the message arrived
    MessageID[MessageID["ID_SND_RECEIPT_ACKED"] = 14] = "ID_SND_RECEIPT_ACKED";
    /// If RakPeerInterface::Send() is called where PacketReliability contains UNRELIABLE_WITH_ACK_RECEIPT, then on a later call to
    /// RakPeerInterface::Receive() you will get ID_SND_RECEIPT_ACKED or ID_SND_RECEIPT_LOSS. The message will be 5 bytes long,
    /// and bytes 1-4 inclusive will contain a number in native order containing a number that identifies this message. This number
    /// will be returned by RakPeerInterface::Send() or RakPeerInterface::SendList(). ID_SND_RECEIPT_LOSS means that an ack for the
    /// message did not arrive (it may or may not have been delivered, probably not). On disconnect or shutdown, you will not get
    /// ID_SND_RECEIPT_LOSS for unsent messages, you should consider those messages as all lost.
    MessageID[MessageID["ID_SND_RECEIPT_LOSS"] = 15] = "ID_SND_RECEIPT_LOSS";
    //
    // USER TYPES - DO NOT CHANGE THESE
    //
    /// RakPeer - In a client/server environment, our connection request to the server has been accepted.
    MessageID[MessageID["ID_CONNECTION_REQUEST_ACCEPTED"] = 16] = "ID_CONNECTION_REQUEST_ACCEPTED";
    /// RakPeer - Sent to the player when a connection request cannot be completed due to inability to connect. 
    MessageID[MessageID["ID_CONNECTION_ATTEMPT_FAILED"] = 17] = "ID_CONNECTION_ATTEMPT_FAILED";
    /// RakPeer - Sent a connect request to a system we are currently connected to.
    MessageID[MessageID["ID_ALREADY_CONNECTED"] = 18] = "ID_ALREADY_CONNECTED";
    /// RakPeer - A remote system has successfully connected.
    MessageID[MessageID["ID_NEW_INCOMING_CONNECTION"] = 19] = "ID_NEW_INCOMING_CONNECTION";
    /// RakPeer - The system we attempted to connect to is not accepting new connections.
    MessageID[MessageID["ID_NO_FREE_INCOMING_CONNECTIONS"] = 20] = "ID_NO_FREE_INCOMING_CONNECTIONS";
    /// RakPeer - The system specified in Packet::systemAddress has disconnected from us.  For the client, this would mean the
    /// server has shutdown. 
    MessageID[MessageID["ID_DISCONNECTION_NOTIFICATION"] = 21] = "ID_DISCONNECTION_NOTIFICATION";
    /// RakPeer - Reliable packets cannot be delivered to the system specified in Packet::systemAddress.  The connection to that
    /// system has been closed. 
    MessageID[MessageID["ID_CONNECTION_LOST"] = 22] = "ID_CONNECTION_LOST";
    /// RakPeer - We are banned from the system we attempted to connect to.
    MessageID[MessageID["ID_CONNECTION_BANNED"] = 23] = "ID_CONNECTION_BANNED";
    /// RakPeer - The remote system is using a password and has refused our connection because we did not set the correct password.
    MessageID[MessageID["ID_INVALID_PASSWORD"] = 24] = "ID_INVALID_PASSWORD";
    // RAKNET_PROTOCOL_VERSION in RakNetVersion.h does not match on the remote system what we have on our system
    // This means the two systems cannot communicate.
    // The 2nd byte of the message contains the value of RAKNET_PROTOCOL_VERSION for the remote system
    MessageID[MessageID["ID_INCOMPATIBLE_PROTOCOL_VERSION"] = 25] = "ID_INCOMPATIBLE_PROTOCOL_VERSION";
    // Means that this IP address connected recently, and can't connect again as a security measure. See
    /// RakPeer::SetLimitIPConnectionFrequency()
    MessageID[MessageID["ID_IP_RECENTLY_CONNECTED"] = 26] = "ID_IP_RECENTLY_CONNECTED";
    /// RakPeer - The sizeof(RakNetTime) bytes following this byte represent a value which is automatically modified by the difference
    /// in system times between the sender and the recipient. Requires that you call SetOccasionalPing.
    MessageID[MessageID["ID_TIMESTAMP"] = 27] = "ID_TIMESTAMP";
    /// RakPeer - Pong from an unconnected system.  First byte is ID_UNCONNECTED_PONG, second sizeof(RakNet::TimeMS) bytes is the ping,
    /// following bytes is system specific enumeration data.
    /// Read using bitstreams
    MessageID[MessageID["ID_UNCONNECTED_PONG"] = 28] = "ID_UNCONNECTED_PONG";
    /// RakPeer - Inform a remote system of our IP/Port. On the recipient, all data past ID_ADVERTISE_SYSTEM is whatever was passed to
    /// the data parameter
    MessageID[MessageID["ID_ADVERTISE_SYSTEM"] = 29] = "ID_ADVERTISE_SYSTEM";
    // RakPeer - Downloading a large message. Format is ID_DOWNLOAD_PROGRESS (MessageID), partCount (unsigned int),
    ///  partTotal (unsigned int),
    /// partLength (unsigned int), first part data (length <= MAX_MTU_SIZE). See the three parameters partCount, partTotal
    ///  and partLength in OnFileProgress in FileListTransferCBInterface.h
    MessageID[MessageID["ID_DOWNLOAD_PROGRESS"] = 30] = "ID_DOWNLOAD_PROGRESS";
    /// ConnectionGraph2 plugin - In a client/server environment, a client other than ourselves has disconnected gracefully.
    ///   Packet::systemAddress is modified to reflect the systemAddress of this client.
    MessageID[MessageID["ID_REMOTE_DISCONNECTION_NOTIFICATION"] = 31] = "ID_REMOTE_DISCONNECTION_NOTIFICATION";
    /// ConnectionGraph2 plugin - In a client/server environment, a client other than ourselves has been forcefully dropped.
    ///  Packet::systemAddress is modified to reflect the systemAddress of this client.
    MessageID[MessageID["ID_REMOTE_CONNECTION_LOST"] = 32] = "ID_REMOTE_CONNECTION_LOST";
    /// ConnectionGraph2 plugin: Bytes 1-4 = count. for (count items) contains {SystemAddress, RakNetGUID, 2 byte ping}
    MessageID[MessageID["ID_REMOTE_NEW_INCOMING_CONNECTION"] = 33] = "ID_REMOTE_NEW_INCOMING_CONNECTION";
    /// FileListTransfer plugin - Setup data
    MessageID[MessageID["ID_FILE_LIST_TRANSFER_HEADER"] = 34] = "ID_FILE_LIST_TRANSFER_HEADER";
    /// FileListTransfer plugin - A file
    MessageID[MessageID["ID_FILE_LIST_TRANSFER_FILE"] = 35] = "ID_FILE_LIST_TRANSFER_FILE";
    // Ack for reference push, to send more of the file
    MessageID[MessageID["ID_FILE_LIST_REFERENCE_PUSH_ACK"] = 36] = "ID_FILE_LIST_REFERENCE_PUSH_ACK";
    /// DirectoryDeltaTransfer plugin - Request from a remote system for a download of a directory
    MessageID[MessageID["ID_DDT_DOWNLOAD_REQUEST"] = 37] = "ID_DDT_DOWNLOAD_REQUEST";
    /// RakNetTransport plugin - Transport provider message, used for remote console
    MessageID[MessageID["ID_TRANSPORT_STRING"] = 38] = "ID_TRANSPORT_STRING";
    /// ReplicaManager plugin - Create an object
    MessageID[MessageID["ID_REPLICA_MANAGER_CONSTRUCTION"] = 39] = "ID_REPLICA_MANAGER_CONSTRUCTION";
    /// ReplicaManager plugin - Changed scope of an object
    MessageID[MessageID["ID_REPLICA_MANAGER_SCOPE_CHANGE"] = 40] = "ID_REPLICA_MANAGER_SCOPE_CHANGE";
    /// ReplicaManager plugin - Serialized data of an object
    MessageID[MessageID["ID_REPLICA_MANAGER_SERIALIZE"] = 41] = "ID_REPLICA_MANAGER_SERIALIZE";
    /// ReplicaManager plugin - New connection, about to send all world objects
    MessageID[MessageID["ID_REPLICA_MANAGER_DOWNLOAD_STARTED"] = 42] = "ID_REPLICA_MANAGER_DOWNLOAD_STARTED";
    /// ReplicaManager plugin - Finished downloading all serialized objects
    MessageID[MessageID["ID_REPLICA_MANAGER_DOWNLOAD_COMPLETE"] = 43] = "ID_REPLICA_MANAGER_DOWNLOAD_COMPLETE";
    /// RakVoice plugin - Open a communication channel
    MessageID[MessageID["ID_RAKVOICE_OPEN_CHANNEL_REQUEST"] = 44] = "ID_RAKVOICE_OPEN_CHANNEL_REQUEST";
    /// RakVoice plugin - Communication channel accepted
    MessageID[MessageID["ID_RAKVOICE_OPEN_CHANNEL_REPLY"] = 45] = "ID_RAKVOICE_OPEN_CHANNEL_REPLY";
    /// RakVoice plugin - Close a communication channel
    MessageID[MessageID["ID_RAKVOICE_CLOSE_CHANNEL"] = 46] = "ID_RAKVOICE_CLOSE_CHANNEL";
    /// RakVoice plugin - Voice data
    MessageID[MessageID["ID_RAKVOICE_DATA"] = 47] = "ID_RAKVOICE_DATA";
    /// Autopatcher plugin - Get a list of files that have changed since a certain date
    MessageID[MessageID["ID_AUTOPATCHER_GET_CHANGELIST_SINCE_DATE"] = 48] = "ID_AUTOPATCHER_GET_CHANGELIST_SINCE_DATE";
    /// Autopatcher plugin - A list of files to create
    MessageID[MessageID["ID_AUTOPATCHER_CREATION_LIST"] = 49] = "ID_AUTOPATCHER_CREATION_LIST";
    /// Autopatcher plugin - A list of files to delete
    MessageID[MessageID["ID_AUTOPATCHER_DELETION_LIST"] = 50] = "ID_AUTOPATCHER_DELETION_LIST";
    /// Autopatcher plugin - A list of files to get patches for
    MessageID[MessageID["ID_AUTOPATCHER_GET_PATCH"] = 51] = "ID_AUTOPATCHER_GET_PATCH";
    /// Autopatcher plugin - A list of patches for a list of files
    MessageID[MessageID["ID_AUTOPATCHER_PATCH_LIST"] = 52] = "ID_AUTOPATCHER_PATCH_LIST";
    /// Autopatcher plugin - Returned to the user: An error from the database repository for the autopatcher.
    MessageID[MessageID["ID_AUTOPATCHER_REPOSITORY_FATAL_ERROR"] = 53] = "ID_AUTOPATCHER_REPOSITORY_FATAL_ERROR";
    /// Autopatcher plugin - Returned to the user: The server does not allow downloading unmodified game files.
    MessageID[MessageID["ID_AUTOPATCHER_CANNOT_DOWNLOAD_ORIGINAL_UNMODIFIED_FILES"] = 54] = "ID_AUTOPATCHER_CANNOT_DOWNLOAD_ORIGINAL_UNMODIFIED_FILES";
    /// Autopatcher plugin - Finished getting all files from the autopatcher
    MessageID[MessageID["ID_AUTOPATCHER_FINISHED_INTERNAL"] = 55] = "ID_AUTOPATCHER_FINISHED_INTERNAL";
    MessageID[MessageID["ID_AUTOPATCHER_FINISHED"] = 56] = "ID_AUTOPATCHER_FINISHED";
    /// Autopatcher plugin - Returned to the user: You must restart the application to finish patching.
    MessageID[MessageID["ID_AUTOPATCHER_RESTART_APPLICATION"] = 57] = "ID_AUTOPATCHER_RESTART_APPLICATION";
    /// NATPunchthrough plugin: internal
    MessageID[MessageID["ID_NAT_PUNCHTHROUGH_REQUEST"] = 58] = "ID_NAT_PUNCHTHROUGH_REQUEST";
    /// NATPunchthrough plugin: internal
    //ID_NAT_GROUP_PUNCHTHROUGH_REQUEST,
    /// NATPunchthrough plugin: internal
    //ID_NAT_GROUP_PUNCHTHROUGH_REPLY,
    /// NATPunchthrough plugin: internal
    MessageID[MessageID["ID_NAT_CONNECT_AT_TIME"] = 59] = "ID_NAT_CONNECT_AT_TIME";
    /// NATPunchthrough plugin: internal
    MessageID[MessageID["ID_NAT_GET_MOST_RECENT_PORT"] = 60] = "ID_NAT_GET_MOST_RECENT_PORT";
    /// NATPunchthrough plugin: internal
    MessageID[MessageID["ID_NAT_CLIENT_READY"] = 61] = "ID_NAT_CLIENT_READY";
    /// NATPunchthrough plugin: internal
    //ID_NAT_GROUP_PUNCHTHROUGH_FAILURE_NOTIFICATION,
    /// NATPunchthrough plugin: Destination system is not connected to the server. Bytes starting at offset 1 contains the
    ///  RakNetGUID destination field of NatPunchthroughClient::OpenNAT().
    MessageID[MessageID["ID_NAT_TARGET_NOT_CONNECTED"] = 62] = "ID_NAT_TARGET_NOT_CONNECTED";
    /// NATPunchthrough plugin: Destination system is not responding to ID_NAT_GET_MOST_RECENT_PORT. Possibly the plugin is not installed.
    ///  Bytes starting at offset 1 contains the RakNetGUID  destination field of NatPunchthroughClient::OpenNAT().
    MessageID[MessageID["ID_NAT_TARGET_UNRESPONSIVE"] = 63] = "ID_NAT_TARGET_UNRESPONSIVE";
    /// NATPunchthrough plugin: The server lost the connection to the destination system while setting up punchthrough.
    ///  Possibly the plugin is not installed. Bytes starting at offset 1 contains the RakNetGUID  destination
    ///  field of NatPunchthroughClient::OpenNAT().
    MessageID[MessageID["ID_NAT_CONNECTION_TO_TARGET_LOST"] = 64] = "ID_NAT_CONNECTION_TO_TARGET_LOST";
    /// NATPunchthrough plugin: This punchthrough is already in progress. Possibly the plugin is not installed.
    ///  Bytes starting at offset 1 contains the RakNetGUID destination field of NatPunchthroughClient::OpenNAT().
    MessageID[MessageID["ID_NAT_ALREADY_IN_PROGRESS"] = 65] = "ID_NAT_ALREADY_IN_PROGRESS";
    /// NATPunchthrough plugin: This message is generated on the local system, and does not come from the network.
    ///  packet::guid contains the destination field of NatPunchthroughClient::OpenNAT(). Byte 1 contains 1 if you are the sender, 0 if not
    MessageID[MessageID["ID_NAT_PUNCHTHROUGH_FAILED"] = 66] = "ID_NAT_PUNCHTHROUGH_FAILED";
    /// NATPunchthrough plugin: Punchthrough succeeded. See packet::systemAddress and packet::guid. Byte 1 contains 1 if you are the sender,
    ///  0 if not. You can now use RakPeer::Connect() or other calls to communicate with this system.
    MessageID[MessageID["ID_NAT_PUNCHTHROUGH_SUCCEEDED"] = 67] = "ID_NAT_PUNCHTHROUGH_SUCCEEDED";
    /// ReadyEvent plugin - Set the ready state for a particular system
    /// First 4 bytes after the message contains the id
    MessageID[MessageID["ID_READY_EVENT_SET"] = 68] = "ID_READY_EVENT_SET";
    /// ReadyEvent plugin - Unset the ready state for a particular system
    /// First 4 bytes after the message contains the id
    MessageID[MessageID["ID_READY_EVENT_UNSET"] = 69] = "ID_READY_EVENT_UNSET";
    /// All systems are in state ID_READY_EVENT_SET
    /// First 4 bytes after the message contains the id
    MessageID[MessageID["ID_READY_EVENT_ALL_SET"] = 70] = "ID_READY_EVENT_ALL_SET";
    /// \internal, do not process in your game
    /// ReadyEvent plugin - Request of ready event state - used for pulling data when newly connecting
    MessageID[MessageID["ID_READY_EVENT_QUERY"] = 71] = "ID_READY_EVENT_QUERY";
    /// Lobby packets. Second byte indicates type.
    MessageID[MessageID["ID_LOBBY_GENERAL"] = 72] = "ID_LOBBY_GENERAL";
    // RPC3, RPC4 error
    MessageID[MessageID["ID_RPC_REMOTE_ERROR"] = 73] = "ID_RPC_REMOTE_ERROR";
    /// Plugin based replacement for RPC system
    MessageID[MessageID["ID_RPC_PLUGIN"] = 74] = "ID_RPC_PLUGIN";
    /// FileListTransfer transferring large files in chunks that are read only when needed, to save memory
    MessageID[MessageID["ID_FILE_LIST_REFERENCE_PUSH"] = 75] = "ID_FILE_LIST_REFERENCE_PUSH";
    /// Force the ready event to all set
    MessageID[MessageID["ID_READY_EVENT_FORCE_ALL_SET"] = 76] = "ID_READY_EVENT_FORCE_ALL_SET";
    /// Rooms function
    MessageID[MessageID["ID_ROOMS_EXECUTE_FUNC"] = 77] = "ID_ROOMS_EXECUTE_FUNC";
    MessageID[MessageID["ID_ROOMS_LOGON_STATUS"] = 78] = "ID_ROOMS_LOGON_STATUS";
    MessageID[MessageID["ID_ROOMS_HANDLE_CHANGE"] = 79] = "ID_ROOMS_HANDLE_CHANGE";
    /// Lobby2 message
    MessageID[MessageID["ID_LOBBY2_SEND_MESSAGE"] = 80] = "ID_LOBBY2_SEND_MESSAGE";
    MessageID[MessageID["ID_LOBBY2_SERVER_ERROR"] = 81] = "ID_LOBBY2_SERVER_ERROR";
    /// Informs user of a new host GUID. Packet::Guid contains this new host RakNetGuid. The old host can be read out using BitStream->Read(RakNetGuid) starting on byte 1
    /// This is not returned until connected to a remote system
    /// If the oldHost is UNASSIGNED_RAKNET_GUID, then this is the first time the host has been determined
    MessageID[MessageID["ID_FCM2_NEW_HOST"] = 82] = "ID_FCM2_NEW_HOST";
    /// \internal For FullyConnectedMesh2 plugin
    MessageID[MessageID["ID_FCM2_REQUEST_FCMGUID"] = 83] = "ID_FCM2_REQUEST_FCMGUID";
    /// \internal For FullyConnectedMesh2 plugin
    MessageID[MessageID["ID_FCM2_RESPOND_CONNECTION_COUNT"] = 84] = "ID_FCM2_RESPOND_CONNECTION_COUNT";
    /// \internal For FullyConnectedMesh2 plugin
    MessageID[MessageID["ID_FCM2_INFORM_FCMGUID"] = 85] = "ID_FCM2_INFORM_FCMGUID";
    /// \internal For FullyConnectedMesh2 plugin
    MessageID[MessageID["ID_FCM2_UPDATE_MIN_TOTAL_CONNECTION_COUNT"] = 86] = "ID_FCM2_UPDATE_MIN_TOTAL_CONNECTION_COUNT";
    /// A remote system (not necessarily the host) called FullyConnectedMesh2::StartVerifiedJoin() with our system as the client
    /// Use FullyConnectedMesh2::GetVerifiedJoinRequiredProcessingList() to read systems
    /// For each system, attempt NatPunchthroughClient::OpenNAT() and/or RakPeerInterface::Connect()
    /// When this has been done for all systems, the remote system will automatically be informed of the results
    /// \note Only the designated client gets this message
    /// \note You won't get this message if you are already connected to all target systems
    /// \note If you fail to connect to a system, this does not automatically mean you will get ID_FCM2_VERIFIED_JOIN_FAILED as that system may have been shutting down from the host too
    /// \sa FullyConnectedMesh2::StartVerifiedJoin()
    MessageID[MessageID["ID_FCM2_VERIFIED_JOIN_START"] = 87] = "ID_FCM2_VERIFIED_JOIN_START";
    /// \internal The client has completed processing for all systems designated in ID_FCM2_VERIFIED_JOIN_START
    MessageID[MessageID["ID_FCM2_VERIFIED_JOIN_CAPABLE"] = 88] = "ID_FCM2_VERIFIED_JOIN_CAPABLE";
    /// Client failed to connect to a required systems notified via FullyConnectedMesh2::StartVerifiedJoin()
    /// RakPeerInterface::CloseConnection() was automatically called for all systems connected due to ID_FCM2_VERIFIED_JOIN_START 
    /// Programmer should inform the player via the UI that they cannot join this session, and to choose a different session
    /// \note Server normally sends us this message, however if connection to the server was lost, message will be returned locally
    /// \note Only the designated client gets this message
    MessageID[MessageID["ID_FCM2_VERIFIED_JOIN_FAILED"] = 89] = "ID_FCM2_VERIFIED_JOIN_FAILED";
    /// The system that called StartVerifiedJoin() got ID_FCM2_VERIFIED_JOIN_CAPABLE from the client and then called RespondOnVerifiedJoinCapable() with true
    /// AddParticipant() has automatically been called for this system
    /// Use GetVerifiedJoinAcceptedAdditionalData() to read any additional data passed to RespondOnVerifiedJoinCapable()
    /// \note All systems in the mesh get this message
    /// \sa RespondOnVerifiedJoinCapable()
    MessageID[MessageID["ID_FCM2_VERIFIED_JOIN_ACCEPTED"] = 90] = "ID_FCM2_VERIFIED_JOIN_ACCEPTED";
    /// The system that called StartVerifiedJoin() got ID_FCM2_VERIFIED_JOIN_CAPABLE from the client and then called RespondOnVerifiedJoinCapable() with false
    /// CloseConnection() has been automatically called for each system connected to since ID_FCM2_VERIFIED_JOIN_START.
    /// The connection is NOT automatically closed to the original host that sent StartVerifiedJoin()
    /// Use GetVerifiedJoinRejectedAdditionalData() to read any additional data passed to RespondOnVerifiedJoinCapable()
    /// \note Only the designated client gets this message
    /// \sa RespondOnVerifiedJoinCapable()
    MessageID[MessageID["ID_FCM2_VERIFIED_JOIN_REJECTED"] = 91] = "ID_FCM2_VERIFIED_JOIN_REJECTED";
    /// UDP proxy messages. Second byte indicates type.
    MessageID[MessageID["ID_UDP_PROXY_GENERAL"] = 92] = "ID_UDP_PROXY_GENERAL";
    /// SQLite3Plugin - execute
    MessageID[MessageID["ID_SQLite3_EXEC"] = 93] = "ID_SQLite3_EXEC";
    /// SQLite3Plugin - Remote database is unknown
    MessageID[MessageID["ID_SQLite3_UNKNOWN_DB"] = 94] = "ID_SQLite3_UNKNOWN_DB";
    /// Events happening with SQLiteClientLoggerPlugin
    MessageID[MessageID["ID_SQLLITE_LOGGER"] = 95] = "ID_SQLLITE_LOGGER";
    /// Sent to NatTypeDetectionServer
    MessageID[MessageID["ID_NAT_TYPE_DETECTION_REQUEST"] = 96] = "ID_NAT_TYPE_DETECTION_REQUEST";
    /// Sent to NatTypeDetectionClient. Byte 1 contains the type of NAT detected.
    MessageID[MessageID["ID_NAT_TYPE_DETECTION_RESULT"] = 97] = "ID_NAT_TYPE_DETECTION_RESULT";
    /// Used by the router2 plugin
    MessageID[MessageID["ID_ROUTER_2_INTERNAL"] = 98] = "ID_ROUTER_2_INTERNAL";
    /// No path is available or can be established to the remote system
    /// Packet::guid contains the endpoint guid that we were trying to reach
    MessageID[MessageID["ID_ROUTER_2_FORWARDING_NO_PATH"] = 99] = "ID_ROUTER_2_FORWARDING_NO_PATH";
    /// \brief You can now call connect, ping, or other operations to the destination system.
    ///
    /// Connect as follows:
    ///
    /// RakNet::BitStream bs(packet->data, packet->length, false);
    /// bs.IgnoreBytes(sizeof(MessageID));
    /// RakNetGUID endpointGuid;
    /// bs.Read(endpointGuid);
    /// unsigned short sourceToDestPort;
    /// bs.Read(sourceToDestPort);
    /// char ipAddressString[32];
    /// packet->systemAddress.ToString(false, ipAddressString);
    /// rakPeerInterface->Connect(ipAddressString, sourceToDestPort, 0,0);
    MessageID[MessageID["ID_ROUTER_2_FORWARDING_ESTABLISHED"] = 100] = "ID_ROUTER_2_FORWARDING_ESTABLISHED";
    /// The IP address for a forwarded connection has changed
    /// Read endpointGuid and port as per ID_ROUTER_2_FORWARDING_ESTABLISHED
    MessageID[MessageID["ID_ROUTER_2_REROUTED"] = 101] = "ID_ROUTER_2_REROUTED";
    /// \internal Used by the team balancer plugin
    MessageID[MessageID["ID_TEAM_BALANCER_INTERNAL"] = 102] = "ID_TEAM_BALANCER_INTERNAL";
    /// Cannot switch to the desired team because it is full. However, if someone on that team leaves, you will
    ///  get ID_TEAM_BALANCER_TEAM_ASSIGNED later.
    /// For TeamBalancer: Byte 1 contains the team you requested to join. Following bytes contain NetworkID of which member
    MessageID[MessageID["ID_TEAM_BALANCER_REQUESTED_TEAM_FULL"] = 103] = "ID_TEAM_BALANCER_REQUESTED_TEAM_FULL";
    /// Cannot switch to the desired team because all teams are locked. However, if someone on that team leaves,
    ///  you will get ID_TEAM_BALANCER_SET_TEAM later.
    /// For TeamBalancer: Byte 1 contains the team you requested to join.
    MessageID[MessageID["ID_TEAM_BALANCER_REQUESTED_TEAM_LOCKED"] = 104] = "ID_TEAM_BALANCER_REQUESTED_TEAM_LOCKED";
    MessageID[MessageID["ID_TEAM_BALANCER_TEAM_REQUESTED_CANCELLED"] = 105] = "ID_TEAM_BALANCER_TEAM_REQUESTED_CANCELLED";
    /// Team balancer plugin informing you of your team. Byte 1 contains the team you requested to join. Following bytes contain NetworkID of which member.
    MessageID[MessageID["ID_TEAM_BALANCER_TEAM_ASSIGNED"] = 106] = "ID_TEAM_BALANCER_TEAM_ASSIGNED";
    /// Gamebryo Lightspeed integration
    MessageID[MessageID["ID_LIGHTSPEED_INTEGRATION"] = 107] = "ID_LIGHTSPEED_INTEGRATION";
    /// XBOX integration
    MessageID[MessageID["ID_XBOX_LOBBY"] = 108] = "ID_XBOX_LOBBY";
    /// The password we used to challenge the other system passed, meaning the other system has called TwoWayAuthentication::AddPassword() with the same password we passed to TwoWayAuthentication::Challenge()
    /// You can read the identifier used to challenge as follows:
    /// RakNet::BitStream bs(packet->data, packet->length, false); bs.IgnoreBytes(sizeof(RakNet::MessageID)); RakNet::RakString password; bs.Read(password);
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_INCOMING_CHALLENGE_SUCCESS"] = 109] = "ID_TWO_WAY_AUTHENTICATION_INCOMING_CHALLENGE_SUCCESS";
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_SUCCESS"] = 110] = "ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_SUCCESS";
    /// A remote system sent us a challenge using TwoWayAuthentication::Challenge(), and the challenge failed.
    /// If the other system must pass the challenge to stay connected, you should call RakPeer::CloseConnection() to terminate the connection to the other system. 
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_INCOMING_CHALLENGE_FAILURE"] = 111] = "ID_TWO_WAY_AUTHENTICATION_INCOMING_CHALLENGE_FAILURE";
    /// The other system did not add the password we used to TwoWayAuthentication::AddPassword()
    /// You can read the identifier used to challenge as follows:
    /// RakNet::BitStream bs(packet->data, packet->length, false); bs.IgnoreBytes(sizeof(MessageID)); RakNet::RakString password; bs.Read(password);
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_FAILURE"] = 112] = "ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_FAILURE";
    /// The other system did not respond within a timeout threshhold. Either the other system is not running the plugin or the other system was blocking on some operation for a long time.
    /// You can read the identifier used to challenge as follows:
    /// RakNet::BitStream bs(packet->data, packet->length, false); bs.IgnoreBytes(sizeof(MessageID)); RakNet::RakString password; bs.Read(password);
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_TIMEOUT"] = 113] = "ID_TWO_WAY_AUTHENTICATION_OUTGOING_CHALLENGE_TIMEOUT";
    /// \internal
    MessageID[MessageID["ID_TWO_WAY_AUTHENTICATION_NEGOTIATION"] = 114] = "ID_TWO_WAY_AUTHENTICATION_NEGOTIATION";
    /// CloudClient / CloudServer
    MessageID[MessageID["ID_CLOUD_POST_REQUEST"] = 115] = "ID_CLOUD_POST_REQUEST";
    MessageID[MessageID["ID_CLOUD_RELEASE_REQUEST"] = 116] = "ID_CLOUD_RELEASE_REQUEST";
    MessageID[MessageID["ID_CLOUD_GET_REQUEST"] = 117] = "ID_CLOUD_GET_REQUEST";
    MessageID[MessageID["ID_CLOUD_GET_RESPONSE"] = 118] = "ID_CLOUD_GET_RESPONSE";
    MessageID[MessageID["ID_CLOUD_UNSUBSCRIBE_REQUEST"] = 119] = "ID_CLOUD_UNSUBSCRIBE_REQUEST";
    MessageID[MessageID["ID_CLOUD_SERVER_TO_SERVER_COMMAND"] = 120] = "ID_CLOUD_SERVER_TO_SERVER_COMMAND";
    MessageID[MessageID["ID_CLOUD_SUBSCRIPTION_NOTIFICATION"] = 121] = "ID_CLOUD_SUBSCRIPTION_NOTIFICATION";
    // LibVoice
    MessageID[MessageID["ID_LIB_VOICE"] = 122] = "ID_LIB_VOICE";
    MessageID[MessageID["ID_RELAY_PLUGIN"] = 123] = "ID_RELAY_PLUGIN";
    MessageID[MessageID["ID_NAT_REQUEST_BOUND_ADDRESSES"] = 124] = "ID_NAT_REQUEST_BOUND_ADDRESSES";
    MessageID[MessageID["ID_NAT_RESPOND_BOUND_ADDRESSES"] = 125] = "ID_NAT_RESPOND_BOUND_ADDRESSES";
    MessageID[MessageID["ID_FCM2_UPDATE_USER_CONTEXT"] = 126] = "ID_FCM2_UPDATE_USER_CONTEXT";
    MessageID[MessageID["ID_RESERVED_3"] = 127] = "ID_RESERVED_3";
    MessageID[MessageID["ID_RESERVED_4"] = 128] = "ID_RESERVED_4";
    MessageID[MessageID["ID_RESERVED_5"] = 129] = "ID_RESERVED_5";
    MessageID[MessageID["ID_RESERVED_6"] = 130] = "ID_RESERVED_6";
    MessageID[MessageID["ID_RESERVED_7"] = 131] = "ID_RESERVED_7";
    MessageID[MessageID["ID_RESERVED_8"] = 132] = "ID_RESERVED_8";
    MessageID[MessageID["ID_RESERVED_9"] = 133] = "ID_RESERVED_9";
    // For the user to use.  Start your first enumeration at this value.
    MessageID[MessageID["ID_USER_PACKET_ENUM"] = 134] = "ID_USER_PACKET_ENUM";
    //-------------------------------------------------------------------------------------------------------------
})(MessageID = exports.MessageID || (exports.MessageID = {}));
;