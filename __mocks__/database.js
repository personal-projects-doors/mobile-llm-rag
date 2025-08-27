import {Database} from '@nozbe/watermelondb';
import {Q} from '@nozbe/watermelondb/QueryDescription';

// Mock models
class ChatSession {
  static table = 'chat_sessions';
  static associations = {
    messages: {type: 'has_many', foreignKey: 'session_id'},
    completion_settings: {type: 'has_many', foreignKey: 'session_id'},
  };
}

class Message {
  static table = 'messages';
  static associations = {
    chat_sessions: {type: 'belongs_to', key: 'session_id'},
  };
}

class CompletionSetting {
  static table = 'completion_settings';
  static associations = {
    chat_sessions: {type: 'belongs_to', key: 'session_id'},
  };
}

class GlobalSetting {
  static table = 'global_settings';
}

class RAGDocument {
  static table = 'rag_documents';
  static associations = {
    rag_chunks: {type: 'has_many', foreignKey: 'document_id'},
  };
}

class RAGChunk {
  static table = 'rag_chunks';
  static associations = {
    rag_documents: {type: 'belongs_to', key: 'document_id'},
  };
}

class RAGSettings {
  static table = 'rag_settings';
}

// Mock schema
const schema = {
  version: 2,
  tables: [
    {
      name: 'chat_sessions',
      columns: [
        {name: 'title', type: 'string'},
        {name: 'date', type: 'string'},
        {name: 'active_pal_id', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    },
    {
      name: 'messages',
      columns: [
        {name: 'session_id', type: 'string', isIndexed: true},
        {name: 'author', type: 'string'},
        {name: 'text', type: 'string', isOptional: true},
        {name: 'type', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'metadata', type: 'string'},
        {name: 'position', type: 'number'},
      ],
    },
    {
      name: 'completion_settings',
      columns: [
        {name: 'session_id', type: 'string', isIndexed: true},
        {name: 'settings', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    },
    {
      name: 'global_settings',
      columns: [
        {name: 'key', type: 'string', isIndexed: true},
        {name: 'value', type: 'string'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    },
    {
      name: 'rag_documents',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'file_path', type: 'string'},
        {name: 'size', type: 'number'},
        {name: 'page_count', type: 'number'},
        {name: 'processed_at', type: 'number', isOptional: true},
        {name: 'is_processed', type: 'boolean'},
        {name: 'chunk_count', type: 'number'},
        {name: 'is_enabled', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    },
    {
      name: 'rag_chunks',
      columns: [
        {name: 'document_id', type: 'string', isIndexed: true},
        {name: 'text', type: 'string'},
        {name: 'page_number', type: 'number'},
        {name: 'chunk_index', type: 'number'},
        {name: 'embedding', type: 'string', isOptional: true},
        {name: 'start_char', type: 'number'},
        {name: 'end_char', type: 'number'},
        {name: 'token_count', type: 'number'},
        {name: 'created_at', type: 'number'},
      ],
    },
    {
      name: 'rag_settings',
      columns: [
        {name: 'chunk_size', type: 'number'},
        {name: 'overlap', type: 'number'},
        {name: 'max_results', type: 'number'},
        {name: 'min_similarity', type: 'number'},
        {name: 'preserve_sentences', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    },
  ],
};

// Mock migrations
const migrations = {
  migrations: [],
};

// Mock adapter
const adapter = {
  schema,
  migrations,
  dbName: 'pocketpalai_test',
  jsi: false,
};

// Mock database
export const database = new Database({
  adapter,
  modelClasses: [ChatSession, Message, CompletionSetting, GlobalSetting, RAGDocument, RAGChunk, RAGSettings],
});

// Export models
export {ChatSession, Message, CompletionSetting, GlobalSetting, RAGDocument, RAGChunk, RAGSettings, Q};
