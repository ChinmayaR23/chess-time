package com.chesstime.service;

import com.chesstime.dto.QueueJoinPayload;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class MatchmakingService {

    private static final int RATING_WINDOW_BASE = 100;
    private static final int RATING_WINDOW_STEP = 50;
    private static final int RATING_WINDOW_INTERVAL_SEC = 30;
    private static final int RATING_WINDOW_MAX = 400;

    public record QueueEntry(
            String sessionId,
            String userId,
            String guestId,
            String name,
            int rating,
            int timeControl,
            long joinedAt
    ) {}

    public record MatchedPair(
            QueueEntry a,
            QueueEntry b,
            String whiteGuestId,
            String blackGuestId
    ) {}

    // keyed by guestId
    private final Map<String, QueueEntry> queue = new ConcurrentHashMap<>();

    public void add(QueueEntry entry) {
        queue.put(entry.guestId(), entry);
        log.debug("Queue joined: {} (rating={}, tc={})", entry.name(), entry.rating(), entry.timeControl());
    }

    public void remove(String guestId) {
        queue.remove(guestId);
    }

    public boolean isInQueue(String guestId) {
        return queue.containsKey(guestId);
    }

    private int getRatingWindow(long joinedAt) {
        long secondsInQueue = (System.currentTimeMillis() - joinedAt) / 1000;
        long steps = secondsInQueue / RATING_WINDOW_INTERVAL_SEC;
        return (int) Math.min(RATING_WINDOW_BASE + steps * RATING_WINDOW_STEP, RATING_WINDOW_MAX);
    }

    public List<MatchedPair> findMatches() {
        List<MatchedPair> pairs = new ArrayList<>();
        Set<String> matched = new HashSet<>();

        // Group by timeControl
        Map<Integer, List<QueueEntry>> byTimeControl = new HashMap<>();
        for (QueueEntry entry : queue.values()) {
            byTimeControl.computeIfAbsent(entry.timeControl(), k -> new ArrayList<>()).add(entry);
        }

        for (List<QueueEntry> group : byTimeControl.values()) {
            group.sort(Comparator.comparingInt(QueueEntry::rating));

            for (int i = 0; i < group.size(); i++) {
                QueueEntry a = group.get(i);
                if (matched.contains(a.guestId())) continue;

                for (int j = i + 1; j < group.size(); j++) {
                    QueueEntry b = group.get(j);
                    if (matched.contains(b.guestId())) continue;

                    int window = Math.max(getRatingWindow(a.joinedAt()), getRatingWindow(b.joinedAt()));
                    if (Math.abs(a.rating() - b.rating()) <= window) {
                        matched.add(a.guestId());
                        matched.add(b.guestId());

                        // Color assignment
                        int ratingDiff = Math.abs(a.rating() - b.rating());
                        String whiteGuestId, blackGuestId;
                        if (ratingDiff > 200) {
                            // Stronger player gets black
                            whiteGuestId = a.rating() < b.rating() ? a.guestId() : b.guestId();
                            blackGuestId = a.rating() < b.rating() ? b.guestId() : a.guestId();
                        } else {
                            boolean rand = Math.random() < 0.5;
                            whiteGuestId = rand ? a.guestId() : b.guestId();
                            blackGuestId = rand ? b.guestId() : a.guestId();
                        }

                        pairs.add(new MatchedPair(a, b, whiteGuestId, blackGuestId));
                        break;
                    }
                }
            }
        }

        // Remove matched entries
        for (MatchedPair pair : pairs) {
            queue.remove(pair.a().guestId());
            queue.remove(pair.b().guestId());
        }

        return pairs;
    }
}
