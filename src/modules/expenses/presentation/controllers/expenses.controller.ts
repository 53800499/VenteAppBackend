import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  GetExpenseProfitQueryDto,
  ListExpensesQueryDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseDto,
  UpsertCategoryBudgetDto,
} from '../../application/dto/expense.dto';
import {
  CreateExpenseCategoryUseCase,
  CreateExpenseUseCase,
  DeleteExpenseUseCase,
  GetExpenseHistoryUseCase,
  GetExpenseProfitUseCase,
  GetExpenseUseCase,
  GetExpensesByCategoryUseCase,
  GetExpensesSummaryUseCase,
  ListExpenseCategoriesUseCase,
  ListExpensesUseCase,
  UpdateExpenseCategoryUseCase,
  UpdateExpenseUseCase,
  UpsertCategoryBudgetUseCase,
  GenerateRecurringExpensesUseCase,
} from '../../application/use-cases/expense.use-cases';

@ApiTags('Dépenses')
@Controller('expenses')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('bearer')
export class ExpensesController {
  constructor(
    private readonly getSummary: GetExpensesSummaryUseCase,
    private readonly getByCategory: GetExpensesByCategoryUseCase,
    private readonly getProfit: GetExpenseProfitUseCase,
    private readonly listCategories: ListExpenseCategoriesUseCase,
    private readonly createCategory: CreateExpenseCategoryUseCase,
    private readonly updateCategory: UpdateExpenseCategoryUseCase,
    private readonly listExpenses: ListExpensesUseCase,
    private readonly getExpense: GetExpenseUseCase,
    private readonly getHistory: GetExpenseHistoryUseCase,
    private readonly createExpense: CreateExpenseUseCase,
    private readonly updateExpense: UpdateExpenseUseCase,
    private readonly deleteExpense: DeleteExpenseUseCase,
    private readonly upsertBudget: UpsertCategoryBudgetUseCase,
    private readonly generateRecurringExpenses: GenerateRecurringExpensesUseCase,
  ) {}

  @Get('summary')
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiOperation({ summary: 'Synthèse dépenses (jour / semaine / mois)' })
  summary(@CurrentAuth() auth: AuthContext) {
    return this.getSummary.execute(auth);
  }

  @Get('by-category')
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiOperation({ summary: 'Répartition des dépenses par catégorie' })
  byCategory(
    @CurrentAuth() auth: AuthContext,
    @Query('from') from?: number,
    @Query('to') to?: number,
  ) {
    return this.getByCategory.execute(auth, { from, to });
  }

  @Get('profit')
  @RequirePermissions(Permission.EXPENSES_READ, Permission.REPORTS_FINANCIAL)
  @ApiOperation({ summary: 'Bénéfice net (marge − dépenses)' })
  profit(@CurrentAuth() auth: AuthContext, @Query() query: GetExpenseProfitQueryDto) {
    return this.getProfit.execute(auth, query);
  }

  @Get('categories')
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiOperation({ summary: 'Lister les catégories de dépenses' })
  categories(@CurrentAuth() auth: AuthContext) {
    return this.listCategories.execute(auth);
  }

  @Post('categories')
  @RequirePermissions(Permission.EXPENSES_CATEGORIES)
  @ApiOperation({ summary: 'Créer une catégorie de dépense' })
  @ApiCreatedResponse({ description: 'Catégorie créée' })
  createCat(@CurrentAuth() auth: AuthContext, @Body() dto: CreateExpenseCategoryDto) {
    return this.createCategory.execute(auth, dto);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.EXPENSES_CATEGORIES)
  @ApiParam({ name: 'id' })
  updateCat(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.updateCategory.execute(auth, id, dto);
  }

  @Put('categories/:id/budget')
  @RequirePermissions(Permission.EXPENSES_CATEGORIES)
  @ApiParam({ name: 'id' })
  budget(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertCategoryBudgetDto,
  ) {
    return this.upsertBudget.execute(auth, id, dto);
  }

  @Get()
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiOperation({ summary: 'Lister les dépenses (filtres période, catégorie, etc.)' })
  list(@CurrentAuth() auth: AuthContext, @Query() query: ListExpensesQueryDto) {
    return this.listExpenses.execute(auth, query);
  }

  @Post()
  @RequirePermissions(Permission.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Enregistrer une dépense (offline-first)' })
  @ApiCreatedResponse({ description: 'Dépense créée' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateExpenseDto) {
    return this.createExpense.execute(auth, dto);
  }

  @Post('recurring/generate')
  @RequirePermissions(Permission.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Générer les dépenses récurrentes dues' })
  triggerRecurringGeneration(@CurrentAuth() auth: AuthContext) {
    return this.generateRecurringExpenses.execute(auth);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiParam({ name: 'id' })
  history(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getHistory.execute(auth, id);
  }

  @Get(':id')
  @RequirePermissions(Permission.EXPENSES_READ)
  @ApiParam({ name: 'id' })
  get(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getExpense.execute(auth, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXPENSES_UPDATE)
  @ApiParam({ name: 'id' })
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.updateExpense.execute(auth, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.EXPENSES_ARCHIVE)
  @ApiParam({ name: 'id' })
  remove(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.deleteExpense.execute(auth, id);
  }
}
