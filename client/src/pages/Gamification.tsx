import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Star } from "lucide-react";

export default function GamificationPage() {
    const { data: goals, isLoading: goalsLoading } = trpc.goals.list.useQuery();
    const { data: achievements, isLoading: achievementsLoading } = trpc.achievements.list.useQuery();

    return (
        <div className="container mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Trophy className="w-8 h-8 text-yellow-600" />
                    Gamificación & Logros
                </h1>
                <p className="text-muted-foreground mt-1">
                    Tu progreso y logros desbloqueados
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Goals */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-600" />
                            Metas Activas
                        </CardTitle>
                        <CardDescription>
                            Tus objetivos actuales y su progreso
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {goalsLoading ? (
                            <div className="text-sm text-muted-foreground">Cargando metas...</div>
                        ) : !goals || goals.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay metas activas
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {goals.map((goal: any) => (
                                    <div key={goal.id} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="font-medium">{goal.type}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {goal.current} / {goal.target}
                                                </p>
                                            </div>
                                            {goal.isCompleted && (
                                                <Badge className="bg-green-500/10 text-green-700">
                                                    ✓ Completada
                                                </Badge>
                                            )}
                                        </div>
                                        <Progress
                                            value={goal.target > 0 ? (goal.current / goal.target) * 100 : 0}
                                            className="h-2"
                                        />
                                        {goal.deadline && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Fecha límite: {new Date(goal.deadline).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Achievements */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Star className="w-5 h-5 text-yellow-600" />
                            Logros Desbloqueados
                        </CardTitle>
                        <CardDescription>
                            Tus achievements y reconocimientos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {achievementsLoading ? (
                            <div className="text-sm text-muted-foreground">Cargando logros...</div>
                        ) : !achievements || achievements.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p>Aún no has desbloqueado logros</p>
                                <p className="text-xs mt-1">¡Sigue trabajando para conseguir tu primer achievement!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {achievements.map((achievement: any) => (
                                    <div
                                        key={achievement.id}
                                        className="border rounded-lg p-4 text-center hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="w-12 h-12 mx-auto mb-2 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                            <Trophy className="w-6 h-6 text-yellow-600" />
                                        </div>
                                        <p className="font-medium text-sm capitalize">{achievement.type}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(achievement.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
