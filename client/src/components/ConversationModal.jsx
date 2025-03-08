import React from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  loadConversation,
  setShowConversationModal,
} from "../store/interpreterSlice";
import ReactMarkdown from "react-markdown";
import "./ConversationModal.css";

const ConversationModal = () => {
  const dispatch = useDispatch();
  const { conversations, showConversationModal } = useSelector(
    (state) => state.interpreter
  );

  if (!showConversationModal) return null;

  const handleClose = () => {
    dispatch(setShowConversationModal(false));
  };

  const handleConversationClick = (conversation) => {
    dispatch(loadConversation(conversation));
    dispatch(setShowConversationModal(false));
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Past Conversations</h2>
          <div className="close-button" onClick={handleClose}>
            ×
          </div>
        </div>
        <div className="conversations-list">
          {conversations?.length > 0 ? (
            conversations.map((conversation) => (
              <div
                key={conversation._id}
                className="conversation-item"
                onClick={() => handleConversationClick(conversation)}
              >
                <div className="conversation-header">
                  <span className="conversation-name">
                    {conversation.name || "Unnamed Conversation"}
                  </span>
                  <span className="conversation-time">
                    {new Date(conversation.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="conversation-summary">
                  <ReactMarkdown>
                    {conversation.summary || "No summary available"}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          ) : (
            <div className="no-conversations">No past conversations found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationModal;
