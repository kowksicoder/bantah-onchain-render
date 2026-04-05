type StoredAgent = {
  id: string;
  name: string;
  username?: string;
  system?: string;
  bio?: string | string[];
  settings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

type StoredEntity = {
  id: string;
  agentId: string;
  names: string[];
  metadata: Record<string, unknown>;
  components?: unknown[];
};

type StoredRoom = {
  id: string;
  agentId?: string;
  name?: string;
  source?: string;
  type?: string;
  metadata?: Record<string, unknown>;
};

export class BantahElizaRuntimeMemoryAdapter {
  db = null;
  private agents = new Map<string, StoredAgent>();
  private entities = new Map<string, StoredEntity>();
  private rooms = new Map<string, StoredRoom>();
  private memories = new Map<string, any>();
  private roomParticipants = new Map<string, Set<string>>();

  async initialize() {}
  async init() {}
  async runMigrations() {}
  async isReady() {
    return true;
  }
  async close() {}
  async getConnection() {
    return null;
  }

  async getAgent(agentId: string) {
    return this.agents.get(agentId) ?? null;
  }

  async getAgents() {
    return Array.from(this.agents.values()).map((agent) => ({
      id: agent.id,
      name: agent.name,
      bio: agent.bio ?? "",
    }));
  }

  async createAgent(agent: Partial<StoredAgent>) {
    if (!agent.id || !agent.name) return false;
    if (this.agents.has(agent.id)) return false;

    this.agents.set(agent.id, {
      id: agent.id,
      name: agent.name,
      username: agent.username,
      system: agent.system,
      bio: agent.bio ?? "",
      settings: agent.settings ?? {},
      createdAt: typeof agent.createdAt === "number" ? agent.createdAt : Date.now(),
      updatedAt: typeof agent.updatedAt === "number" ? agent.updatedAt : Date.now(),
    });
    return true;
  }

  async updateAgent(agentId: string, agent: Partial<StoredAgent>) {
    const existing = this.agents.get(agentId);
    if (!existing) return false;
    this.agents.set(agentId, {
      ...existing,
      ...agent,
      id: agentId,
      updatedAt: Date.now(),
    });
    return true;
  }

  async deleteAgent(agentId: string) {
    return this.agents.delete(agentId);
  }

  async ensureEmbeddingDimension() {}

  async getEntitiesByIds(entityIds: string[]) {
    const items = entityIds
      .map((id) => this.entities.get(id))
      .filter(Boolean) as StoredEntity[];
    return items.length ? items : null;
  }

  async getEntitiesForRoom() {
    return [];
  }

  async createEntities(entities: StoredEntity[]) {
    for (const entity of entities) {
      this.entities.set(entity.id, {
        ...entity,
        components: entity.components ?? [],
        metadata: entity.metadata ?? {},
      });
    }
    return true;
  }

  async updateEntity(entity: StoredEntity) {
    this.entities.set(entity.id, entity);
  }

  async getComponent() {
    return null;
  }

  async getComponents() {
    return [];
  }

  async createComponent() {
    return true;
  }

  async updateComponent() {}

  async deleteComponent() {}

  async getMemories() {
    return [];
  }

  async getMemoriesByRoomIds() {
    return [];
  }

  async getMemoryById(memoryId: string) {
    return this.memories.get(memoryId) ?? null;
  }

  async createMemory(memory: any) {
    this.memories.set(memory.id, memory);
    return memory;
  }

  async updateMemory(memory: any) {
    this.memories.set(memory.id, memory);
    return true;
  }

  async removeMemory(memoryId: string) {
    this.memories.delete(memoryId);
  }

  async removeAllMemories() {
    this.memories.clear();
  }

  async countMemories() {
    return this.memories.size;
  }

  async searchMemories() {
    return [];
  }

  async getCachedEmbeddings() {
    return [];
  }

  async log() {}

  async getRoom(roomId: string) {
    return this.rooms.get(roomId) ?? null;
  }

  async getRoomsByIds(roomIds: string[]) {
    return roomIds
      .map((id) => this.rooms.get(id))
      .filter(Boolean);
  }

  async getRooms() {
    return Array.from(this.rooms.values());
  }

  async createRoom(room: StoredRoom) {
    this.rooms.set(room.id, room);
    return true;
  }

  async createRooms(rooms: StoredRoom[]) {
    for (const room of rooms) {
      this.rooms.set(room.id, room);
    }
    return true;
  }

  async updateRoom(roomId: string, updates: Partial<StoredRoom>) {
    const existing = this.rooms.get(roomId);
    if (!existing) return null;
    const next = { ...existing, ...updates, id: roomId };
    this.rooms.set(roomId, next);
    return next;
  }

  async deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  async getRoomsForParticipant() {
    return [];
  }

  async addParticipants() {}

  async addParticipantsRoom(roomId: string, participantIds: string[]) {
    const current = this.roomParticipants.get(roomId) ?? new Set<string>();
    for (const participantId of participantIds) {
      current.add(participantId);
    }
    this.roomParticipants.set(roomId, current);
    return true;
  }

  async removeParticipant() {}

  async removeParticipantsRoom(roomId: string, participantIds: string[]) {
    const current = this.roomParticipants.get(roomId);
    if (!current) return true;
    for (const participantId of participantIds) {
      current.delete(participantId);
    }
    return true;
  }

  async getParticipantsForEntity() {
    return [];
  }

  async getParticipantsForRoom(roomId: string) {
    return Array.from(this.roomParticipants.get(roomId) ?? []);
  }

  async createRelationship() {
    return true;
  }

  async getRelationships() {
    return [];
  }

  async createCache() {
    return true;
  }

  async getCache() {
    return null;
  }

  async deleteCache() {
    return true;
  }

  async getTasks() {
    return [];
  }

  async createTask() {
    return true;
  }

  async updateTask() {
    return true;
  }

  async deleteTask() {
    return true;
  }
}
